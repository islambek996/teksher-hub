package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.document.DocumentReadAccessPolicy;
import kg.teksherhub.document.DocumentRecord;
import kg.teksherhub.document.DocumentRepository;
import kg.teksherhub.process.BusinessProcessGuide;
import kg.teksherhub.process.BusinessProcessGuideRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class McpKnowledgeService {
    private static final int MAX_RESULTS = 12;
    private static final int MAX_CONTEXT = 5_000;

    private final DocumentRepository documents;
    private final BusinessProcessGuideRepository businessProcesses;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final TnvedCatalogService tnvedCatalog;

    public McpKnowledgeService(DocumentRepository documents,
                               BusinessProcessGuideRepository businessProcesses,
                               JdbcTemplate jdbc,
                               ObjectMapper mapper,
                               TnvedCatalogService tnvedCatalog) {
        this.documents = documents;
        this.businessProcesses = businessProcesses;
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.tnvedCatalog = tnvedCatalog;
    }

    public ToolResult searchNpa(String query, String jurisdiction, String documentNumber,
                                String documentDate, String role) {
        String q = normalize(query);
        String country = normalizeJurisdiction(jurisdiction);
        String number = normalize(documentNumber);
        LocalDate date = parseOptionalDate(documentDate);
        List<DocumentRecord> matches = visibleDocuments(role).stream()
                .filter(d -> normalize(d.getKind()).contains("нормативный акт"))
                .filter(d -> country.isBlank() || country.equalsIgnoreCase(d.getJurisdiction()))
                .filter(d -> number.isBlank() || normalize(d.getDocumentNumber()).contains(number))
                .filter(d -> date == null || date.equals(d.getDocumentDate()))
                .filter(d -> q.isBlank() || searchable(d).contains(q))
                .sorted(Comparator.comparingInt(McpKnowledgeService::npaPriority)
                        .thenComparing(DocumentRecord::getUpdatedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_RESULTS)
                .toList();

        List<KnowledgeSource> sources = matches.stream().map(this::documentSource).toList();
        List<NpaHit> hits = matches.stream().map(d -> new NpaHit(
                d.getId().toString(), d.getTitle(), d.getJurisdiction(), d.getKind(),
                d.getDocumentNumber(), string(d.getDocumentDate()), string(d.getEffectiveFrom()),
                string(d.getEffectiveUntil()), statusLabel(d), d.getSourceUrl(),
                string(d.getOfficialSourceCheckedAt()), d.getSourceCheckNote())).toList();
        String summary = hits.isEmpty()
                ? "По заданным фильтрам нормативные акты в доступных пользователю карточках не найдены."
                : "Найдено нормативных актов: " + hits.size()
                    + ". Статус и редакцию каждого акта необходимо сверять по указанному первоисточнику.";
        return new ToolResult("search_npa", summary,
                Map.of("query", q, "jurisdiction", country, "documentNumber", number,
                        "documentDate", date == null ? "" : date.toString(), "results", hits),
                sources);
    }

    public ToolResult searchProductGroups(String query, String role) {
        String q = normalize(query);
        if (q.length() < 2) throw new IllegalArgumentException("Для поиска товарной группы укажите не менее двух символов.");

        List<String> payloadRows = jdbc.query(
                "SELECT payload_json FROM product_group_catalog WHERE id = 1",
                (rs, rowNum) -> rs.getString("payload_json"));
        JsonNode payload = payloadRows.isEmpty() ? mapper.createObjectNode() : readJson(payloadRows.getFirst());
        List<Map<String, Object>> mzkm = new ArrayList<>();
        List<Map<String, Object>> internal = new ArrayList<>();
        List<Map<String, Object>> details = new ArrayList<>();
        List<KnowledgeSource> sources = new ArrayList<>();

        JsonNode mzkmGroups = payload.path("mzkmGroups");
        if (mzkmGroups.isArray()) {
            for (JsonNode group : mzkmGroups) {
                String name = group.asText("");
                if (contains(name, q)) {
                    mzkm.add(Map.of("name", name, "jurisdiction", "KG", "catalog", "MZKM"));
                    sources.add(catalogSource("mzkm", name,
                            "Товарная группа МЗКМ: " + name,
                            "Каталог товарных групп МЗКМ. Само включение в каталог не устанавливает юридическую обязанность маркировки."));
                }
            }
        }

        JsonNode internalGroups = payload.path("internalGroups");
        if (internalGroups.isArray()) {
            for (JsonNode group : internalGroups) {
                String name = group.path("name").asText("");
                String description = group.path("description").asText("");
                String source = group.path("source").asText("");
                if (contains(name + " " + description, q)) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", name);
                    row.put("description", description);
                    row.put("source", source);
                    internal.add(row);
                    sources.add(catalogSource("internal", name,
                            "Внутренняя товарная группа КР: " + name,
                            description + (source.isBlank() ? "" : "\nИсточник: " + source)));
                }
            }
        }

        JsonNode groupDetails = payload.path("mzkmDetails");
        if (groupDetails.isObject()) {
            var fields = groupDetails.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                String name = entry.getKey();
                String description = entry.getValue().path("description").asText("");
                String source = entry.getValue().path("source").asText("");
                if (contains(name + " " + description, q)) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", name);
                    row.put("description", description);
                    row.put("source", source);
                    details.add(row);
                    sources.add(catalogSource("detail", name,
                            "Карточка товарной группы: " + name,
                            description + (source.isBlank() ? "" : "\nИсточник: " + source)));
                }
            }
        }

        List<DocumentRecord> related = visibleDocuments(role).stream()
                .filter(d -> contains(join(d.getTitle(), d.getProductGroup(), d.getArea()), q))
                .limit(8).toList();
        for (DocumentRecord document : related) sources.add(documentSource(document));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("mzkmGroups", mzkm);
        data.put("internalGroups", internal);
        data.put("groupDetails", details);
        data.put("relatedKnowledgeCards", related.stream().map(d -> new NpaHit(
                d.getId().toString(), d.getTitle(), d.getJurisdiction(), d.getKind(),
                d.getDocumentNumber(), string(d.getDocumentDate()), string(d.getEffectiveFrom()),
                string(d.getEffectiveUntil()), statusLabel(d), d.getSourceUrl(),
                string(d.getOfficialSourceCheckedAt()), d.getSourceCheckNote())).toList());

        int hitCount = mzkm.size() + internal.size() + details.size() + related.size();
        String summary = hitCount == 0
                ? "Подходящие товарные группы и карточки в доступном каталоге не найдены."
                : "Найдены записи каталога и связанные карточки: " + hitCount
                    + ". Для юридической применимости проверяйте первоисточник и конкретный код ТН ВЭД.";
        return new ToolResult("search_product_groups", summary, data, deduplicateSources(sources));
    }

    public ToolResult checkTnvedCode(String rawCode, String role) {
        String code = clean(rawCode).replaceAll("[\\s.-]", "");
        TnvedCatalogService.SearchResult catalogResult = tnvedCatalog.search(code);

        List<KnowledgeSource> sources = new ArrayList<>();
        List<TnvedCatalogHit> catalogHits = catalogResult.matches().stream().map(entry -> {
            String scopeLabel = "MZKM".equals(entry.scope())
                    ? "Товарная группа МЗКМ" : "Внутренняя маркировка КР";
            String context = "Код ТН ВЭД: " + entry.code()
                    + "\nНаименование: " + entry.name()
                    + "\nГруппа: " + entry.group()
                    + "\nКонтур справочника: " + scopeLabel
                    + "\nКод ГСКП: " + entry.gskpCode()
                    + "\nНаименование ГСКП: " + entry.gskpName()
                    + "\nИсточник набора: " + entry.source()
                    + "\nОграничение: запись классификационного справочника не подтверждает обязательность маркировки.";
            sources.add(new KnowledgeSource("tnved:" + entry.scope() + ":" + entry.code() + ":" + entry.group(),
                    "TNVED_CATALOG", entry.code() + " – " + entry.name(), "KG",
                    scopeLabel, "USER_REFERENCE", "Справочник кодов ТН ВЭД",
                    "", "", "", "", entry.code() + " – " + entry.name(),
                    truncate(context, 1_500), 1));
            return new TnvedCatalogHit(entry.code(), entry.name(), entry.group(), entry.scope(),
                    entry.gskpCode(), entry.gskpName());
        }).toList();

        List<CodeHit> operatorMatches = new ArrayList<>();
        for (DocumentRecord document : visibleDocuments(role)) {
            String content = join(document.getContent(), document.getKeywords(), document.getDocumentNumber());
            if (content.isBlank()) continue;
            List<String> lines = matchingCodeLines(content, code);
            if (!lines.isEmpty()) {
                operatorMatches.add(new CodeHit(document.getId().toString(), code,
                        code.length() == 10 ? "EXACT_10_DIGIT" : "PREFIX_MATCH",
                        document.getProductGroup(), document.getJurisdiction(), statusLabel(document),
                        lines, document.getSourceUrl()));
                sources.add(documentSource(document, String.join("\n", lines)));
            }
            if (operatorMatches.size() >= 10) break;
        }

        String summary = catalogHits.isEmpty() && operatorMatches.isEmpty()
                ? "Код не найден в основном каталоге и в доступных пользователю операторских материалах."
                : "Совпадений в основном каталоге: " + catalogResult.totalMatches()
                    + "; операторских справочных материалов: " + operatorMatches.size()
                    + ". Совпадение не является юридическим подтверждением обязательности маркировки.";
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requestedCode", catalogResult.requestedCode());
        data.put("matchType", catalogResult.matchType());
        data.put("catalogTotalMatches", catalogResult.totalMatches());
        data.put("catalogEntries", catalogHits);
        data.put("operatorReferenceMatches", operatorMatches);
        data.put("legalConclusion", "NOT_DETERMINED");
        data.put("legalWarning", "Наличие кода в справочнике или перечне оператора само по себе не подтверждает обязательность маркировки. Проверьте действующий НПА, полное описание товара, юрисдикцию и исключения.");
        return new ToolResult("check_tnved_code", summary, data, deduplicateSources(sources));
    }

    public ToolResult getBusinessProcess(String query, String role) {
        String q = normalize(query);
        if (q.length() < 2) throw new IllegalArgumentException("Укажите название или тему бизнес-процесса.");
        List<BusinessProcessGuide> matches = businessProcesses.findAllByOrderByOrderIndexAscTitleAsc().stream()
                .filter(guide -> isPrivileged(role) || "PUBLISHED".equals(guide.getWorkflowStatus()))
                .filter(guide -> contains(join(guide.getTitle(), guide.getCategory(), guide.getSummary(),
                        guide.getScope(), guide.getSearchTerm(), guide.getStepsJson()), q))
                .limit(8).toList();
        List<KnowledgeSource> sources = new ArrayList<>();
        List<Map<String, Object>> guides = new ArrayList<>();
        for (BusinessProcessGuide guide : matches) {
            JsonNode steps = readJson(guide.getStepsJson());
            JsonNode processSources = readJson(guide.getSourcesJson());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", guide.getId());
            row.put("title", guide.getTitle());
            row.put("category", guide.getCategory());
            row.put("summary", guide.getSummary());
            row.put("scope", guide.getScope());
            row.put("workflowStatus", guide.getWorkflowStatus());
            row.put("sources", processSources);
            row.put("steps", steps);
            guides.add(row);
            String firstSource = firstSourceUrl(processSources);
            String context = "Бизнес-процесс: " + guide.getTitle()
                    + "\nКатегория: " + guide.getCategory()
                    + "\nСтатус публикации: " + guide.getWorkflowStatus()
                    + "\nОписание: " + guide.getSummary()
                    + "\nИсточники: " + processSources
                    + "\nШаги: " + steps;
            sources.add(new KnowledgeSource(guide.getId(), "BUSINESS_PROCESS", guide.getTitle(),
                    "KG", "Бизнес-процесс", guide.getWorkflowStatus(),
                    "PUBLISHED".equals(guide.getWorkflowStatus()) ? "Опубликован" : "Внутренний материал",
                    firstSource, "", "", "", guide.getSummary(), truncate(context, MAX_CONTEXT), 1));
        }
        String summary = guides.isEmpty()
                ? "Подходящие бизнес-процессы не найдены среди доступных пользователю материалов."
                : "Найдено бизнес-процессов: " + guides.size() + ". Используйте источники, связанные с каждым процессом, для проверки нормативных оснований.";
        return new ToolResult("get_business_process", summary, Map.of("query", q, "processes", guides), sources);
    }

    public ToolResult getSourceMonitorStatus(String jurisdiction, String role) {
        String country = normalizeJurisdiction(jurisdiction);
        boolean privileged = isPrivileged(role);
        List<MonitorStatus> statuses = jdbc.query("""
                SELECT m.id, m.name, m.jurisdiction, m.source_url, m.enabled, m.interval_hours,
                       m.last_checked_at, m.last_http_status, m.last_change_detected_at, m.last_error,
                       (SELECT COUNT(*) FROM source_monitor_documents md WHERE md.monitor_id = m.id) AS linked_documents,
                       (SELECT COUNT(*) FROM source_monitor_processes mp WHERE mp.monitor_id = m.id) AS linked_processes,
                       (SELECT COUNT(*) FROM source_monitor_changes mc WHERE mc.monitor_id = m.id AND mc.status = 'OPEN') AS open_changes
                FROM source_monitors m
                WHERE (? = '' OR m.jurisdiction = ?)
                  AND (? = TRUE OR EXISTS (
                      SELECT 1 FROM source_monitor_documents md
                      JOIN documents d ON d.id = md.document_id
                      WHERE md.monitor_id = m.id AND d.status = 'ACTIVE'
                        AND LOWER(d.kind) NOT LIKE '%внутрен%'
                  ) OR EXISTS (
                      SELECT 1 FROM source_monitor_processes mp
                      JOIN business_process_guides p ON p.id = mp.process_id
                      WHERE mp.monitor_id = m.id AND p.workflow_status = 'PUBLISHED'
                  ))
                ORDER BY m.jurisdiction, m.name
                LIMIT 100
                """, (rs, rowNum) -> new MonitorStatus(
                rs.getLong("id"), rs.getString("name"), rs.getString("jurisdiction"),
                rs.getString("source_url"), rs.getBoolean("enabled"), rs.getInt("interval_hours"),
                instant(rs.getTimestamp("last_checked_at")), rs.getObject("last_http_status") == null
                        ? null : rs.getInt("last_http_status"),
                instant(rs.getTimestamp("last_change_detected_at")), privileged ? rs.getString("last_error") : null,
                rs.getLong("linked_documents"), rs.getLong("linked_processes"), rs.getLong("open_changes")),
                country, country, privileged);
        List<KnowledgeSource> sources = statuses.stream().map(m -> new KnowledgeSource(
                "monitor:" + m.id(), "MONITOR_STATUS", m.name(), m.jurisdiction(),
                "Мониторинг официального источника", m.enabled() ? "ENABLED" : "DISABLED",
                m.enabled() ? "Включён" : "Отключён", m.sourceUrl(), "", "", string(m.lastCheckedAt()),
                "Проверка: " + string(m.lastCheckedAt()) + "; открытых событий: " + m.openChanges(),
                "Источник: " + m.sourceUrl() + "\nВключён: " + m.enabled()
                        + "\nИнтервал: " + m.intervalHours() + " ч\nHTTP: " + m.lastHttpStatus()
                        + "\nПоследняя проверка: " + m.lastCheckedAt()
                        + "\nПоследнее обнаруженное изменение: " + m.lastChangeDetectedAt()
                        + "\nСвязанных карточек: " + m.linkedDocuments()
                        + "\nСвязанных процессов: " + m.linkedProcesses()
                        + "\nОткрытых сигналов: " + m.openChanges()
                        + (privileged && m.lastError() != null ? "\nОшибка: " + m.lastError() : ""),
                1)).toList();
        return new ToolResult("get_source_monitor_status",
                "Получен статус источников мониторинга: " + statuses.size() + ". Хеш-мониторинг фиксирует изменение ответа, а не юридическое значение изменения.",
                Map.of("jurisdiction", country, "monitors", statuses), sources);
    }

    public ToolResult listSourceChangeEvents(String jurisdiction, Integer requestedLimit, String role) {
        String country = normalizeJurisdiction(jurisdiction);
        boolean privileged = isPrivileged(role);
        int limit = requestedLimit == null ? 20 : Math.max(1, Math.min(50, requestedLimit));
        List<MonitorEvent> events = jdbc.query("""
                SELECT c.id, c.monitor_id, m.name AS monitor_name, m.jurisdiction, m.source_url,
                       c.previous_hash, c.current_hash, c.previous_content_type, c.current_content_type,
                       c.previous_content_snapshot, c.current_content_snapshot,
                       c.detected_at, c.status, c.reviewed_at, c.reviewed_by, c.review_note
                FROM source_monitor_changes c
                JOIN source_monitors m ON m.id = c.monitor_id
                WHERE (? = '' OR m.jurisdiction = ?)
                  AND (? = TRUE OR EXISTS (
                      SELECT 1 FROM source_monitor_documents md
                      JOIN documents d ON d.id = md.document_id
                      WHERE md.monitor_id = m.id AND d.status = 'ACTIVE'
                        AND LOWER(d.kind) NOT LIKE '%внутрен%'
                  ) OR EXISTS (
                      SELECT 1 FROM source_monitor_processes mp
                      JOIN business_process_guides p ON p.id = mp.process_id
                      WHERE mp.monitor_id = m.id AND p.workflow_status = 'PUBLISHED'
                  ))
                ORDER BY c.detected_at DESC, c.id DESC
                LIMIT ?
                """, (rs, rowNum) -> new MonitorEvent(
                rs.getLong("id"), rs.getLong("monitor_id"), rs.getString("monitor_name"),
                rs.getString("jurisdiction"), rs.getString("source_url"),
                rs.getString("previous_hash"), rs.getString("current_hash"),
                rs.getString("previous_content_type"), rs.getString("current_content_type"),
                privileged ? rs.getString("previous_content_snapshot") : null,
                privileged ? rs.getString("current_content_snapshot") : null,
                instant(rs.getTimestamp("detected_at")), rs.getString("status"),
                privileged ? instant(rs.getTimestamp("reviewed_at")) : null,
                privileged ? rs.getString("reviewed_by") : null,
                privileged ? rs.getString("review_note") : null),
                country, country, privileged, limit);
        List<KnowledgeSource> sources = events.stream().map(event -> new KnowledgeSource(
                "monitor:" + event.monitorId() + ":event:" + event.id(), "MONITOR_EVENT",
                "Изменение источника: " + event.monitorName(), event.jurisdiction(),
                "Событие мониторинга", event.status(),
                "ACKNOWLEDGED".equals(event.status()) ? "Сигнал просмотрен" : "Требует просмотра",
                event.sourceUrl(), "", "", string(event.detectedAt()),
                "Обнаружено изменение контрольной суммы " + string(event.detectedAt()),
                "Источник: " + event.sourceUrl()
                        + "\nПредыдущий SHA-256: " + event.previousHash()
                        + "\nНовый SHA-256: " + event.currentHash()
                        + "\nСтатус: " + event.status()
                        + (privileged && event.previousSnapshot() != null
                            ? "\nПредыдущий текстовый снимок: " + truncate(event.previousSnapshot(), 2_000) : "")
                        + (privileged && event.currentSnapshot() != null
                            ? "\nТекущий текстовый снимок: " + truncate(event.currentSnapshot(), 2_000) : "")
                        + (privileged && event.reviewNote() != null
                            ? "\nКомментарий проверяющего: " + event.reviewNote() : "")
                        + "\nВажно: изменение хеша не устанавливает изменение правового статуса акта.",
                1)).toList();
        return new ToolResult("list_source_change_events",
                "Получено событий мониторинга: " + events.size() + ". Изменение контрольной суммы требует ручной проверки.",
                Map.of("jurisdiction", country, "limit", limit, "events", events), sources);
    }

    static List<String> matchingCodeLines(String content, String code) {
        if (content == null || content.isBlank() || code == null || code.isBlank()) return List.of();
        Pattern pattern = code.length() == 10
                ? Pattern.compile("(?<![0-9])" + Pattern.quote(code) + "(?![0-9])")
                : Pattern.compile("(?<![0-9])" + Pattern.quote(code) + "[0-9]{1," + (10 - code.length()) + "}(?![0-9])");
        List<String> lines = new ArrayList<>();
        for (String line : content.split("\\R")) {
            Matcher matcher = pattern.matcher(line);
            if (matcher.find()) {
                lines.add(truncate(line.trim(), 500));
                if (lines.size() >= 10) break;
            }
        }
        return List.copyOf(lines);
    }

    private List<DocumentRecord> visibleDocuments(String role) {
        return documents.findAllByOrderByUpdatedAtDesc().stream()
                .filter(d -> d.getStatus() != null)
                .filter(d -> DocumentReadAccessPolicy.canRead(role, d.getStatus().name(), d.getKind()))
                .toList();
    }

    private KnowledgeSource documentSource(DocumentRecord d) {
        return documentSource(d, d.getContent());
    }

    private KnowledgeSource documentSource(DocumentRecord d, String excerpt) {
        String context = "Название: " + d.getTitle()
                + "\nЮрисдикция: " + d.getJurisdiction()
                + "\nТип: " + d.getKind()
                + "\nНомер: " + d.getDocumentNumber()
                + "\nДата документа: " + d.getDocumentDate()
                + "\nДействует с: " + d.getEffectiveFrom()
                + "\nДействует по: " + d.getEffectiveUntil()
                + "\nСтатус базы: " + statusLabel(d)
                + "\nОфициальный источник: " + d.getSourceUrl()
                + "\nОтметка проверки: " + d.getOfficialSourceCheckedAt()
                + "\nКомментарий проверки: " + d.getSourceCheckNote()
                + "\nОписание: " + d.getDescription()
                + "\nСодержание: " + truncate(d.getContent(), 3_000);
        return new KnowledgeSource(d.getId().toString(), "DOCUMENT", d.getTitle(),
                d.getJurisdiction(), d.getKind(), d.getStatus().name(), d.getStatus().label(),
                d.getSourceUrl(), string(d.getEffectiveFrom()), string(d.getEffectiveUntil()),
                string(d.getOfficialSourceCheckedAt()), truncate(excerpt, 500),
                truncate(context, MAX_CONTEXT), 1);
    }

    private static KnowledgeSource catalogSource(String idSuffix, String title, String excerpt, String description) {
        return new KnowledgeSource("catalog:" + idSuffix + ":" + title, "PRODUCT_GROUP",
                title, "KG", "Товарная группа", "CATALOG", "Справочная запись каталога",
                "", "", "", "", truncate(excerpt, 400), truncate(description, 2_000), 1);
    }

    private static List<KnowledgeSource> deduplicateSources(List<KnowledgeSource> values) {
        Map<String, KnowledgeSource> unique = new LinkedHashMap<>();
        for (KnowledgeSource source : values) unique.putIfAbsent(source.sourceType() + ":" + source.id(), source);
        return List.copyOf(unique.values());
    }

    private JsonNode readJson(String value) {
        try {
            return mapper.readTree(value == null || value.isBlank() ? "[]" : value);
        } catch (Exception ex) {
            return mapper.createArrayNode();
        }
    }

    private static String firstSourceUrl(JsonNode sources) {
        if (sources != null && sources.isArray()) {
            for (JsonNode source : sources) {
                String url = source.path("url").asText("");
                if (!url.isBlank()) return url;
            }
        }
        return "";
    }

    private static String searchable(DocumentRecord d) {
        return normalize(join(d.getTitle(), d.getDescription(), d.getArea(), d.getKind(),
                d.getJurisdiction(), d.getProductGroup(), d.getKeywords(), d.getDocumentNumber(),
                d.getSourceUrl(), d.getContent()));
    }

    private static int npaPriority(DocumentRecord d) {
        if (d.getStatus() == null) return 5;
        return switch (d.getStatus()) {
            case ACTIVE -> 0;
            case UNDER_REVIEW -> 1;
            case DRAFT -> 2;
            case EXPIRED -> 3;
            case ARCHIVED -> 4;
        };
    }

    private static String statusLabel(DocumentRecord d) {
        return d.getStatus() == null ? "UNKNOWN" : d.getStatus().label();
    }

    private static String normalizeJurisdiction(String value) {
        String country = clean(value).toUpperCase(Locale.ROOT);
        if (!country.isBlank() && !Set.of("KG", "RU", "EAEU").contains(country)) {
            throw new IllegalArgumentException("Юрисдикция должна быть KG, RU или EAEU.");
        }
        return country;
    }

    private static LocalDate parseOptionalDate(String value) {
        if (clean(value).isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Дата документа должна быть в формате YYYY-MM-DD.");
        }
    }

    private static boolean isPrivileged(String role) {
        return "ADMIN".equalsIgnoreCase(role) || "EDITOR".equalsIgnoreCase(role);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private static String status(DocumentRecord d) {
        return statusLabel(d);
    }

    private static String normalize(String value) {
        return clean(value).toLowerCase(Locale.ROOT).replace('ё', 'е');
    }

    private static boolean contains(String haystack, String needle) {
        return normalize(haystack).contains(normalize(needle));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String join(String... values) {
        StringBuilder result = new StringBuilder();
        for (String value : values) {
            if (value != null && !value.isBlank()) result.append(value).append(' ');
        }
        return result.toString();
    }

    private static String string(Object value) {
        return value == null ? "" : value.toString();
    }

    private static String truncate(String value, int maximum) {
        if (value == null) return "";
        String text = value.trim();
        return text.length() <= maximum ? text : text.substring(0, maximum - 1).stripTrailing() + "…";
    }

    public record ToolResult(String tool, String summary, Object data, List<KnowledgeSource> sources) {}
    public record KnowledgeSource(String id, String sourceType, String title, String jurisdiction,
            String kind, String status, String statusLabel, String sourceUrl,
            String effectiveFrom, String effectiveUntil, String checkedAt,
            String excerpt, String context, int score) {}
    public record NpaHit(String id, String title, String jurisdiction, String kind, String documentNumber,
            String documentDate, String effectiveFrom, String effectiveUntil, String status,
            String sourceUrl, String checkedAt, String sourceCheckNote) {}
    public record CodeHit(String documentId, String requestedCode, String matchType, String productGroup,
            String jurisdiction, String documentStatus, List<String> matchingLines, String sourceUrl) {}
    public record TnvedCatalogHit(String code, String name, String group, String scope,
            String gskpCode, String gskpName) {}
    public record MonitorStatus(long id, String name, String jurisdiction, String sourceUrl, boolean enabled,
            int intervalHours, Instant lastCheckedAt, Integer lastHttpStatus, Instant lastChangeDetectedAt,
            String lastError, long linkedDocuments, long linkedProcesses, long openChanges) {}
    public record MonitorEvent(long id, long monitorId, String monitorName, String jurisdiction, String sourceUrl,
            String previousHash, String currentHash, String previousContentType, String currentContentType,
            String previousSnapshot, String currentSnapshot, Instant detectedAt, String status,
            Instant reviewedAt, String reviewedBy, String reviewNote) {}
}
