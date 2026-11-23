package kg.teksherhub.monitor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import javax.net.ssl.SSLException;
import java.io.IOException;
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
import java.util.LinkedHashSet;
import java.util.UUID;
import java.sql.Timestamp;

@Service
public class SourceMonitorService {
    private static final int MAX_BODY_BYTES = 2 * 1024 * 1024;
    private static final int MAX_REQUEST_ATTEMPTS = 3;
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
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
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
        boolean sourceChanged = !uri.toString().equals(m.getSourceUrl());
        m.setName(request.name().trim());
        m.setJurisdiction(request.jurisdiction());
        m.setSourceUrl(uri.toString());
        if (sourceChanged) {
            m.setLastCheckedAt(null);
            m.setLastHttpStatus(null);
            m.setLastContentHash(null);
            m.setLastContentType(null);
            m.setLastContentSnapshot(null);
            m.setLastChangeDetectedAt(null);
            m.setLastError(null);
        }
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

    @Transactional(readOnly = true)
    public SourceMonitorTargetsResponse targets(Long monitorId) {
        find(monitorId);
        List<SourceMonitorTargetsResponse.DocumentTarget> linkedDocuments = jdbc.query("""
                SELECT d.id, d.title, d.jurisdiction, d.kind, d.status
                FROM source_monitor_documents link
                JOIN documents d ON d.id = link.document_id
                WHERE link.monitor_id = ?
                ORDER BY LOWER(d.title), d.id
                """, (rs, rowNum) -> new SourceMonitorTargetsResponse.DocumentTarget(
                UUID.fromString(rs.getString("id")), rs.getString("title"),
                rs.getString("jurisdiction"), rs.getString("kind"), rs.getString("status")), monitorId);
        List<SourceMonitorTargetsResponse.BusinessProcessTarget> linkedProcesses = jdbc.query("""
                SELECT p.id, p.title, p.workflow_status
                FROM source_monitor_processes link
                JOIN business_process_guides p ON p.id = link.process_id
                WHERE link.monitor_id = ?
                ORDER BY LOWER(p.title), p.id
                """, (rs, rowNum) -> new SourceMonitorTargetsResponse.BusinessProcessTarget(
                rs.getString("id"), rs.getString("title"), rs.getString("workflow_status")), monitorId);
        return new SourceMonitorTargetsResponse(linkedDocuments, linkedProcesses);
    }

    @Transactional
    public SourceMonitorTargetsResponse replaceTargets(Long monitorId, SourceMonitorTargetsRequest request,
                                                        String username) {
        find(monitorId);
        List<UUID> documentIds = request == null || request.documentIds() == null
                ? List.of() : request.documentIds().stream().filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.collectingAndThen(
                            java.util.stream.Collectors.toCollection(LinkedHashSet::new), List::copyOf));
        List<String> processIds = request == null || request.processIds() == null
                ? List.of() : request.processIds().stream().filter(java.util.Objects::nonNull)
                    .map(String::trim).filter(value -> !value.isBlank()).distinct().toList();
        if (documentIds.size() > 200 || processIds.size() > 200) {
            throw new IllegalArgumentException("К одному источнику можно привязать не более 200 документов и 200 бизнес-процессов.");
        }
        for (UUID documentId : documentIds) {
            Boolean exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM documents WHERE id = ?)",
                    Boolean.class, documentId);
            if (!Boolean.TRUE.equals(exists)) {
                throw new IllegalArgumentException("Один или несколько связанных документов не найдены.");
            }
        }
        for (String processId : processIds) {
            if (processId.length() > 80) throw new IllegalArgumentException("Некорректный идентификатор бизнес-процесса.");
            Boolean exists = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM business_process_guides WHERE id = ?)",
                    Boolean.class, processId);
            if (!Boolean.TRUE.equals(exists)) {
                throw new IllegalArgumentException("Один или несколько связанных бизнес-процессов не найдены.");
            }
        }
        jdbc.update("DELETE FROM source_monitor_documents WHERE monitor_id = ?", monitorId);
        jdbc.update("DELETE FROM source_monitor_processes WHERE monitor_id = ?", monitorId);
        for (UUID documentId : documentIds) {
            jdbc.update("""
                    INSERT INTO source_monitor_documents(monitor_id, document_id, added_by, added_at)
                    VALUES (?, ?, ?, NOW())
                    """, monitorId, documentId, username);
        }
        for (String processId : processIds) {
            jdbc.update("""
                    INSERT INTO source_monitor_processes(monitor_id, process_id, added_by, added_at)
                    VALUES (?, ?, ?, NOW())
                    """, monitorId, processId, username);
        }
        SourceMonitor monitor = find(monitorId);
        audit(username, "LINK_TARGETS", monitor,
                "Связи обновлены: документов – " + documentIds.size() + ", бизнес-процессов – " + processIds.size());
        return targets(monitorId);
    }

    @Transactional(readOnly = true)
    public List<SourceMonitorChangeResponse> changes(Long monitorId) {
        find(monitorId);
        return jdbc.query("""
                SELECT id, monitor_id, previous_hash, current_hash,
                       previous_content_type, current_content_type,
                       previous_content_snapshot, current_content_snapshot,
                       detected_at, status, reviewed_at, reviewed_by, review_note
                FROM source_monitor_changes
                WHERE monitor_id = ?
                ORDER BY detected_at DESC, id DESC
                LIMIT 50
                """, (rs, rowNum) -> changeResponse(rs), monitorId);
    }

    @Transactional
    public SourceMonitorChangeResponse acknowledgeChange(Long monitorId, Long changeId,
                                                           String note, String username) {
        find(monitorId);
        String cleanNote = note == null ? "" : note.trim();
        if (cleanNote.isBlank()) throw new IllegalArgumentException("Укажите результат проверки сигнала.");
        if (cleanNote.length() > 1000) throw new IllegalArgumentException("Комментарий не должен превышать 1000 символов.");
        int updated = jdbc.update("""
                UPDATE source_monitor_changes
                SET status = 'ACKNOWLEDGED', reviewed_at = NOW(), reviewed_by = ?, review_note = ?
                WHERE id = ? AND monitor_id = ? AND status = 'OPEN'
                """, username, cleanNote, changeId, monitorId);
        if (updated == 0) {
            Boolean exists = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM source_monitor_changes WHERE id = ? AND monitor_id = ?)",
                    Boolean.class, changeId, monitorId);
            if (!Boolean.TRUE.equals(exists)) throw new IllegalArgumentException("Событие изменения не найдено.");
            throw new IllegalArgumentException("Этот сигнал уже отмечен как просмотренный.");
        }
        SourceMonitor monitor = find(monitorId);
        audit(username, "ACKNOWLEDGE_CHANGE", monitor,
                "Сигнал изменения #" + changeId + " просмотрен. " + cleanNote);
        return jdbc.queryForObject("""
                SELECT id, monitor_id, previous_hash, current_hash,
                       previous_content_type, current_content_type,
                       previous_content_snapshot, current_content_snapshot,
                       detected_at, status, reviewed_at, reviewed_by, review_note
                FROM source_monitor_changes
                WHERE id = ? AND monitor_id = ?
                """, (rs, rowNum) -> changeResponse(rs), changeId, monitorId);
    }

    private static SourceMonitorChangeResponse changeResponse(java.sql.ResultSet rs) throws java.sql.SQLException {
        String previous = rs.getString("previous_content_snapshot");
        String current = rs.getString("current_content_snapshot");
        boolean previousTruncated = previous != null && previous.length() > 20000;
        boolean currentTruncated = current != null && current.length() > 20000;
        return new SourceMonitorChangeResponse(
                rs.getLong("id"), rs.getLong("monitor_id"),
                toInstant(rs.getTimestamp("detected_at")),
                rs.getString("previous_hash"), rs.getString("current_hash"),
                rs.getString("previous_content_type"), rs.getString("current_content_type"),
                preview(previous), preview(current),
                previous != null && current != null, previousTruncated, currentTruncated,
                rs.getString("status"), toInstant(rs.getTimestamp("reviewed_at")),
                rs.getString("reviewed_by"), rs.getString("review_note"));
    }

    private static String preview(String value) {
        if (value == null) return null;
        return value.length() <= 20000 ? value : value.substring(0, 20000);
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static boolean isTextualContentType(String contentType) {
        if (contentType == null) return false;
        String normalized = contentType.toLowerCase(Locale.ROOT);
        return normalized.startsWith("text/") || normalized.contains("json")
                || normalized.contains("xml") || normalized.contains("javascript")
                || normalized.contains("x-www-form-urlencoded");
    }

    private Long recordChange(SourceMonitor monitor, String previousHash, String currentHash,
                              String previousContentType, String currentContentType,
                              String previousSnapshot, String currentSnapshot) {
        return jdbc.queryForObject("""
                INSERT INTO source_monitor_changes(
                    monitor_id, previous_hash, current_hash,
                    previous_content_type, current_content_type,
                    previous_content_snapshot, current_content_snapshot,
                    detected_at, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'OPEN')
                RETURNING id
                """, Long.class, monitor.getId(), previousHash, currentHash,
                previousContentType, currentContentType, previousSnapshot, currentSnapshot);
    }

    private void notifyUsersAboutChange(SourceMonitor monitor, Long changeId) {
        String title = "Изменение официального источника: " + monitor.getName();
        if (title.length() > 200) title = title.substring(0, 200);
        Long documentCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM source_monitor_documents WHERE monitor_id = ?", Long.class, monitor.getId());
        Long processCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM source_monitor_processes WHERE monitor_id = ?", Long.class, monitor.getId());
        String message = "Обнаружено изменение ответа официального источника " + monitor.getSourceUrl()
                + ". Связано документов: " + documentCount + ", бизнес-процессов: " + processCount
                + ". Событие #" + changeId + ". Сравните текстовые снимки (если доступны) и вручную проверьте связанные материалы. Сигнал не является юридическим выводом.";
        if (message.length() > 980) message = message.substring(0, 980);
        jdbc.update("""
                INSERT INTO hub_notifications(username, task_id, title, message, created_at)
                SELECT DISTINCT u.username, NULL, ?, ?, NOW()
                FROM users u
                WHERE u.enabled = TRUE
                  AND (
                    u.role IN ('ADMIN', 'EDITOR')
                    OR u.username IN (
                        SELECT d.created_by FROM source_monitor_documents link
                        JOIN documents d ON d.id = link.document_id WHERE link.monitor_id = ?
                        UNION
                        SELECT d.updated_by FROM source_monitor_documents link
                        JOIN documents d ON d.id = link.document_id WHERE link.monitor_id = ?
                        UNION
                        SELECT p.created_by FROM source_monitor_processes link
                        JOIN business_process_guides p ON p.id = link.process_id WHERE link.monitor_id = ?
                        UNION
                        SELECT p.updated_by FROM source_monitor_processes link
                        JOIN business_process_guides p ON p.id = link.process_id WHERE link.monitor_id = ?
                    )
                  )
                """, title, message, monitor.getId(), monitor.getId(), monitor.getId(), monitor.getId());
    }

    private void check(SourceMonitor m) {
        m.setLastCheckedAt(Instant.now());
        try {
            URI uri = validateAllowedUrl(m.getSourceUrl());
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20))
                    .header("User-Agent", "TEKSHER-HUB-SourceMonitor/1.0")
                    .header("Accept", "text/html, text/plain, application/pdf, application/json, */*")
                    .GET().build();
            HttpResponse<InputStream> response = sendWithRetry(request);
            m.setLastHttpStatus(response.statusCode());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                try { response.body().close(); } catch (Exception ignored) {}
                m.setLastError("Источник вернул HTTP " + response.statusCode() + ". Автоматические переходы по redirect отключены.");
                return;
            }
            String contentType = response.headers().firstValue("Content-Type").orElse("");
            byte[] body;
            try (InputStream stream = response.body()) {
                body = stream.readNBytes(MAX_BODY_BYTES + 1);
            }
            if (body.length > MAX_BODY_BYTES) {
                m.setLastError("Ответ превышает лимит 2 МБ; содержимое не хешировалось.");
                return;
            }
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
            String previousHash = m.getLastContentHash();
            String currentSnapshot = isTextualContentType(contentType)
                    ? new String(body, StandardCharsets.UTF_8) : null;
            if (previousHash != null && !previousHash.equals(hash)) {
                m.setLastChangeDetectedAt(Instant.now());
                Long changeId = recordChange(m, previousHash, hash,
                        m.getLastContentType(), contentType, m.getLastContentSnapshot(), currentSnapshot);
                audit("SYSTEM", "SOURCE_CHANGE", m,
                        "Изменилась контрольная сумма ответа официального источника. Предыдущий SHA-256: "
                                + previousHash.substring(0, Math.min(12, previousHash.length()))
                                + "; новый SHA-256: " + hash.substring(0, 12)
                                + ". Создано событие #" + changeId + "; требуется ручная проверка юридического значения изменений.");
                notifyUsersAboutChange(m, changeId);
            }
            m.setLastContentHash(hash);
            m.setLastContentType(contentType.length() > 160 ? contentType.substring(0, 160) : contentType);
            m.setLastContentSnapshot(currentSnapshot);
            m.setLastError(null);
        } catch (Exception ex) {
            m.setLastError(safeError(ex));
        }
    }

    private HttpResponse<InputStream> sendWithRetry(HttpRequest request) throws IOException, InterruptedException {
        IOException lastError = null;
        for (int attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt++) {
            try {
                return httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            } catch (SSLException ex) {
                // Never retry by weakening TLS: a certificate failure must remain visible.
                throw ex;
            } catch (IOException ex) {
                lastError = ex;
                if (attempt == MAX_REQUEST_ATTEMPTS) break;
                try {
                    Thread.sleep(500L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw interrupted;
                }
            }
        }
        throw lastError == null ? new IOException("Не удалось подключиться к источнику") : lastError;
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
        if (ex instanceof SSLException) {
            return "Ошибка TLS-сертификата: " + (ex.getMessage() == null ? "проверка цепочки сертификатов не пройдена" : ex.getMessage())
                    + ". Проверка SSL не отключена; проверьте цепочку сертификатов источника и хранилище доверенных CA в runtime.";
        }
        String message = ex.getMessage();
        if (message == null || message.isBlank()) return ex.getClass().getSimpleName();
        return message.substring(0, Math.min(900, message.length()));
    }

    private void notifyUsersAboutChange(SourceMonitor monitor) {
        String title = "Изменение официального источника: " + monitor.getName();
        if (title.length() > 200) title = title.substring(0, 200);
        String message = "Мониторинг обнаружил изменение содержимого страницы: " + monitor.getSourceUrl()
                + ". Это не подтверждает изменение правового статуса акта. Проверьте опубликованный текст, текущую редакцию, дату вступления в силу и применимость к товарной группе.";
        if (message.length() > 980) message = message.substring(0, 980);
        jdbc.update("""
                INSERT INTO hub_notifications(username, task_id, title, message, created_at)
                SELECT username, NULL, ?, ?, NOW()
                FROM users
                WHERE enabled = TRUE
                """, title, message);
    }

    private SourceMonitor find(Long id) {
        return repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Источник мониторинга не найден"));
    }
}
