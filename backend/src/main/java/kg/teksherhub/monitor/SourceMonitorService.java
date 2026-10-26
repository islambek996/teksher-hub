package kg.teksherhub.monitor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class SourceMonitorService {
    private static final int MAX_BODY_BYTES = 2 * 1024 * 1024;
    private final SourceMonitorRepository repository;
    private final JdbcTemplate jdbc;
    private final Set<String> allowedHosts;
    private final HttpClient httpClient;

    public SourceMonitorService(SourceMonitorRepository repository, JdbcTemplate jdbc,
                                @Value("${app.monitor.allowed-hosts}") String hosts) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.allowedHosts = java.util.Arrays.stream(hosts.split(",")).map(String::trim)
                .map(s -> s.toLowerCase(Locale.ROOT)).filter(s -> !s.isBlank()).collect(java.util.stream.Collectors.toUnmodifiableSet());
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public List<SourceMonitorResponse> list() {
        return repository.findAllByOrderByUpdatedAtDesc().stream().map(SourceMonitorResponse::from).toList();
    }

    @Transactional
    public SourceMonitorResponse create(SourceMonitorRequest request, String username) {
        URI uri = validateAllowedUrl(request.sourceUrl());
        SourceMonitor m = new SourceMonitor();
        m.setName(request.name().trim());
        m.setJurisdiction(request.jurisdiction());
        m.setSourceUrl(uri.toString());
        m.setEnabled(request.enabled());
        m.setIntervalHours(request.intervalHours() < 1 ? 24 : request.intervalHours());
        m.setCreatedBy(username);
        m.setCreatedAt(Instant.now());
        m.setUpdatedAt(Instant.now());
        SourceMonitor saved = repository.save(m);
        audit(username, "CREATE", saved, "Добавлен источник мониторинга");
        return SourceMonitorResponse.from(saved);
    }

    @Transactional
    public SourceMonitorResponse update(Long id, SourceMonitorRequest request, String username) {
        SourceMonitor m = find(id);
        URI uri = validateAllowedUrl(request.sourceUrl());
        m.setName(request.name().trim());
        m.setJurisdiction(request.jurisdiction());
        m.setSourceUrl(uri.toString());
        m.setEnabled(request.enabled());
        m.setIntervalHours(request.intervalHours() < 1 ? 24 : request.intervalHours());
        m.setUpdatedAt(Instant.now());
        SourceMonitor saved = repository.save(m);
        audit(username, "UPDATE", saved, "Изменены настройки источника мониторинга");
        return SourceMonitorResponse.from(saved);
    }

    @Transactional
    public void delete(Long id, String username) {
        SourceMonitor monitor = find(id);
        audit(username, "DELETE", monitor, "Источник мониторинга удалён");
        repository.delete(monitor);
    }

    @Transactional
    public SourceMonitorResponse checkNow(Long id, String username) {
        SourceMonitor m = find(id);
        check(m);
        SourceMonitor saved = repository.save(m);
        audit(username, "CHECK_SOURCE", saved, saved.getLastError() == null ? "Источник проверен" : "Ошибка проверки: " + saved.getLastError());
        return SourceMonitorResponse.from(saved);
    }

    private void audit(String username, String action, SourceMonitor monitor, String details) {
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, ?, 'SOURCE_MONITOR', ?, ?, ?, NOW())
                """, username, action, String.valueOf(monitor.getId()), monitor.getName(), details);
    }

    @Transactional
    public int checkDue() {
        Instant now = Instant.now();
        int checked = 0;
        List<SourceMonitor> monitors = repository.findAllByEnabledTrue();
        for (SourceMonitor m : monitors) {
            if (m.getLastCheckedAt() == null || m.getLastCheckedAt().plusSeconds(m.getIntervalHours() * 3600L).isBefore(now)) {
                check(m);
                repository.save(m);
                checked++;
            }
        }
        return checked;
    }

    private void check(SourceMonitor m) {
        m.setLastCheckedAt(Instant.now());
        try {
            URI uri = validateAllowedUrl(m.getSourceUrl());
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(12))
                    .header("User-Agent", "TEKSHER-HUB-SourceMonitor/1.0")
                    .header("Accept", "text/html, text/plain, application/pdf, application/json, */*")
                    .GET().build();
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            m.setLastHttpStatus(response.statusCode());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                try { response.body().close(); } catch (Exception ignored) {}
                m.setLastError("Источник вернул HTTP " + response.statusCode() + ". Автоматические переходы по redirect отключены.");
                return;
            }
            byte[] body;
            try (InputStream stream = response.body()) {
                body = stream.readNBytes(MAX_BODY_BYTES + 1);
            }
            if (body.length > MAX_BODY_BYTES) {
                m.setLastError("Ответ превышает лимит 2 МБ; содержимое не хешировалось.");
                return;
            }
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
            if (m.getLastContentHash() != null && !m.getLastContentHash().equals(hash)) {
                m.setLastChangeDetectedAt(Instant.now());
            }
            m.setLastContentHash(hash);
            m.setLastError(null);
        } catch (Exception ex) {
            m.setLastError(safeError(ex));
        }
    }

    private URI validateAllowedUrl(String value) {
        try {
            URI uri = URI.create(value.trim()).normalize();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if ((!scheme.equals("https") && !scheme.equals("http")) || host.isBlank() || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("Нужна корректная ссылка HTTP/HTTPS");
            }
            boolean allowed = allowedHosts.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
            if (!allowed) throw new IllegalArgumentException("Домен не входит в список разрешённых официальных источников мониторинга. Добавьте домен в MONITOR_ALLOWED_HOSTS после проверки.");
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress() || isUniqueLocalIpv6(address.getAddress())) {
                    throw new IllegalArgumentException("Мониторинг частных и локальных адресов запрещён");
                }
            }
            return uri;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Не удалось проверить адрес источника");
        }
    }

    private static boolean isUniqueLocalIpv6(byte[] bytes) {
        return bytes.length == 16 && (Byte.toUnsignedInt(bytes[0]) & 0xfe) == 0xfc;
    }
    private static String safeError(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) return ex.getClass().getSimpleName();
        return message.substring(0, Math.min(900, message.length()));
    }

    private SourceMonitor find(Long id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Источник мониторинга не найден"));
    }
}