package kg.teksherhub.document;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DocumentService {
    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentFileRepository files;
    private final FileStorageService storage;
    private final DocumentLinkRepository links;
    private final JdbcTemplate jdbc;

    public DocumentService(DocumentRepository documents, DocumentVersionRepository versions, DocumentFileRepository files,
                           FileStorageService storage, DocumentLinkRepository links, JdbcTemplate jdbc) {
        this.documents = documents;
        this.versions = versions;
        this.files = files;
        this.storage = storage;
        this.links = links;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(String query, String jurisdiction, String kind, String status) {
        String q = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        java.util.Set<UUID> attachmentMatches = q.isBlank() ? java.util.Set.of()
                : new java.util.HashSet<>(files.findDocumentIdsWithExtractedTextContaining(q));
        return documents.findAllByOrderByUpdatedAtDesc().stream()
                .filter(d -> q.isBlank() || searchableMetadata(d).contains(q) || attachmentMatches.contains(d.getId()))
                .filter(d -> jurisdiction == null || jurisdiction.isBlank() || jurisdiction.equalsIgnoreCase(d.getJurisdiction()))
                .filter(d -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(d.getKind()))
                .filter(d -> status == null || status.isBlank() || status.equalsIgnoreCase(d.getStatus().name()))
                .map(d -> toResponse(d, !q.isBlank() && attachmentMatches.contains(d.getId())))
                .toList();
    }


    /**
     * Exports card metadata and authored text for review/transfer. This is not a database
     * backup and intentionally does not embed binary attachment contents.
     */
    @Transactional(readOnly = true)
    public byte[] exportCsv() {
        StringBuilder csv = new StringBuilder().append((char) 0xFEFF);
        appendCsvRow(csv,
                "ID", "Название", "Юрисдикция", "Тип материала", "Тематическая область",
                "Товарная группа", "Ключевые слова", "Номер документа", "Дата документа",
                "Действует с", "Действует по", "Официальный источник", "Описание", "Содержание",
                "Статус", "Код статуса", "Последняя проверка источника", "Комментарий проверки",
                "Добавил", "Обновил", "Создано", "Последнее изменение", "Версия карточки", "Количество файлов");

        for (DocumentRecord d : documents.findAllByOrderByUpdatedAtDesc()) {
            appendCsvRow(csv,
                    d.getId(), d.getTitle(), d.getJurisdiction(), d.getKind(), d.getArea(),
                    d.getProductGroup(), d.getKeywords(), d.getDocumentNumber(), d.getDocumentDate(),
                    d.getEffectiveFrom(), d.getEffectiveUntil(), d.getSourceUrl(), d.getDescription(),
                    d.getContent(), d.getStatus() == null ? null : d.getStatus().label(),
                    d.getStatus() == null ? null : d.getStatus().name(), d.getOfficialSourceCheckedAt(),
                    d.getSourceCheckNote(), d.getCreatedBy(), d.getUpdatedBy(), d.getCreatedAt(),
                    d.getUpdatedAt(), d.getVersionNumber(), files.countByDocumentId(d.getId()));
        }
        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    static void appendCsvRow(StringBuilder output, Object... values) {
        for (int i = 0; i < values.length; i++) {
            if (i > 0) output.append(';');
            String value = values[i] == null ? "" : values[i].toString();
            // CSV quoting alone does not prevent spreadsheet formula execution.
            // Prefix potentially executable cell values with an apostrophe before quoting.
            String formulaCheck = value.stripLeading();
            if (!formulaCheck.isEmpty() && "=+@-".indexOf(formulaCheck.charAt(0)) >= 0) {
                value = "'" + value;
            }
            output.append('"').append(value.replace("\"", "\"\"")).append('"');
        }
        output.append("\r\n");
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(UUID id) { return toResponse(findEntity(id)); }

    @Transactional(readOnly = true)
    public Set<UUID> readableDocumentIdsFor(String role) {
        return documents.findAllByOrderByUpdatedAtDesc().stream()
                .filter(document -> document.getStatus() != null
                        && DocumentReadAccessPolicy.canRead(role, document.getStatus().name(), document.getKind()))
                .map(DocumentRecord::getId)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional
    public DocumentResponse create(DocumentRequest request, String username) {
        validate(request);
        DocumentRecord d = new DocumentRecord();
        apply(d, request, true);
        d.setId(UUID.randomUUID());
        d.setCreatedBy(username);
        d.setUpdatedBy(username);
        d.setCreatedAt(Instant.now());
        d.setUpdatedAt(Instant.now());
        d.setVersionNumber(1);
        d = documents.save(d);
        saveLinks(d, request.relatedDocumentIds());
        recordVersion(d, username, text(request.changeNote(), "Создание карточки"));
        recordAudit(username, "CREATE", d, text(request.changeNote(), "Создание карточки"));
        return toResponse(d);
    }

    @Transactional
    public DocumentResponse update(UUID id, DocumentRequest request, String username) {
        validate(request);
        DocumentRecord d = findEntity(id);
        apply(d, request, false);
        d.setUpdatedBy(username);
        d.setUpdatedAt(Instant.now());
        d.setVersionNumber(d.getVersionNumber() + 1);
        d = documents.save(d);
        saveLinks(d, request.relatedDocumentIds());
        recordVersion(d, username, text(request.changeNote(), "Обновление карточки"));
        recordAudit(username, "UPDATE", d, text(request.changeNote(), "Обновление карточки"));
        return toResponse(d);
    }

    @Transactional
    public DocumentResponse review(UUID id, ReviewRequest request, String username) {
        DocumentRecord d = findEntity(id);
        DocumentStatus next;
        try { next = DocumentStatus.valueOf(request.status()); }
        catch (Exception ex) { throw new IllegalArgumentException("Недопустимый статус проверки"); }
        if (next == DocumentStatus.ACTIVE && (d.getSourceUrl() == null || d.getSourceUrl().isBlank())) {
            throw new IllegalArgumentException("Нельзя отметить документ действующим без ссылки на источник");
        }
        // Only explicit confirmation of currentness records a source-check timestamp.
        // Moving a document to "under review" must not look like a completed legal check.
        if (next == DocumentStatus.ACTIVE) {
            d.setOfficialSourceCheckedAt(Instant.now());
        } else if (next == DocumentStatus.DRAFT) {
            d.setOfficialSourceCheckedAt(null);
        }
        d.setStatus(next);
        d.setSourceCheckNote(text(request.note(), "Проверено вручную"));
        d.setUpdatedBy(username);
        d.setUpdatedAt(Instant.now());
        d.setVersionNumber(d.getVersionNumber() + 1);
        d = documents.save(d);
        recordVersion(d, username, "Проверка актуальности: " + d.getStatus().label());
        recordAudit(username, "REVIEW", d, "Статус проверки: " + d.getStatus().label()
                + ". " + text(request.note(), "Проверено вручную"));
        return toResponse(d);
    }

    @Transactional
    public void delete(UUID id, String username) {
        DocumentRecord d = findEntity(id);
        recordAudit(username, "DELETE", d, "Карточка документа удалена");

        // Keep the physical files until the database transaction commits. Otherwise a failed
        // database delete could leave the document row in place while its attachments are gone.
        List<String> storedNames = files.findAllByDocumentIdOrderByUploadedAtDesc(id).stream()
                .map(DocumentFile::getStoredName)
                .toList();

        // A document can be referenced by both its own related-document links and links
        // owned by other documents. Remove both directions, plus version snapshots and files,
        // before deleting the parent. This avoids Hibernate flushing a managed child which
        // still points at the DocumentRecord being removed.
        links.deleteAllByDocumentId(id);
        links.deleteAllByRelatedDocumentId(id);
        versions.deleteAllByDocumentId(id);
        files.deleteAllByDocumentId(id);

        // Flush child deletions before marking the parent for deletion so there are no
        // persistent DocumentLink/DocumentVersion/DocumentFile instances referencing it.
        links.flush();
        versions.flush();
        files.flush();

        documents.delete(d);
        documents.flush();

        if (!storedNames.isEmpty() && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (String storedName : storedNames) {
                        try {
                            storage.delete(storedName);
                        } catch (RuntimeException ex) {
                            // The database row is already deleted. Log storage cleanup failures
                            // for later maintenance rather than returning a misleading failed delete.
                            log.error("Document deleted but attachment file cleanup failed: {}", storedName, ex);
                        }
                    }
                }
            });
        }
    }

    @Transactional(readOnly = true)
    public List<VersionResponse> history(UUID id) {
        findEntity(id);
        return versions.findAllByDocumentIdOrderByVersionNumberDesc(id).stream().map(VersionResponse::from).toList();
    }

    @Transactional
    public int markExpiredDocuments() {
        List<DocumentRecord> due = documents.findByEffectiveUntilBeforeAndStatus(LocalDate.now(), DocumentStatus.ACTIVE);
        for (DocumentRecord d : due) {
            d.setStatus(DocumentStatus.EXPIRED);
            d.setUpdatedAt(Instant.now());
            d.setUpdatedBy("system-expiry-job");
            d.setVersionNumber(d.getVersionNumber() + 1);
            documents.save(d);
            recordVersion(d, "system-expiry-job", "Автоматически отмечено по дате окончания действия");
        }
        return due.size();
    }

    public DocumentRecord findEntity(UUID id) {
        return documents.findById(id).orElseThrow(() -> new IllegalArgumentException("Документ не найден"));
    }

    private DocumentResponse toResponse(DocumentRecord d) {
        return toResponse(d, false);
    }

    private DocumentResponse toResponse(DocumentRecord d, boolean matchedInAttachment) {
        return DocumentResponse.from(d, files.countByDocumentId(d.getId()),
                links.findRelatedIdsByDocumentId(d.getId()), matchedInAttachment);
    }


    private void recordAudit(String username, String action, DocumentRecord document, String details) {
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, ?, 'DOCUMENT', ?, ?, ?, NOW())
                """, username, action, document.getId().toString(), document.getTitle(), details);
    }

    private void recordVersion(DocumentRecord document, String username, String note) {
        DocumentVersion version = DocumentVersion.snapshot(document, username, note);
        version.setRelatedDocumentIds(links.findRelatedIdsByDocumentId(document.getId()).stream()
                .map(UUID::toString).collect(java.util.stream.Collectors.joining(",")));
        versions.save(version);
    }

    private void saveLinks(DocumentRecord document, List<UUID> requestedIds) {
        links.deleteAllByDocumentId(document.getId());
        if (requestedIds == null || requestedIds.isEmpty()) return;
        List<UUID> uniqueIds = requestedIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (uniqueIds.contains(document.getId())) {
            throw new IllegalArgumentException("Документ не может быть связан сам с собой");
        }
        List<DocumentRecord> relatedDocuments = documents.findAllById(uniqueIds);
        if (relatedDocuments.size() != uniqueIds.size()) {
            throw new IllegalArgumentException("Один или несколько связанных документов не найдены");
        }
        for (DocumentRecord related : relatedDocuments) {
            DocumentLink link = new DocumentLink();
            link.setId(new DocumentLinkId(document.getId(), related.getId()));
            link.setDocument(document);
            link.setRelatedDocument(related);
            link.setCreatedAt(Instant.now());
            links.save(link);
        }
    }

    private static String searchableMetadata(DocumentRecord d) {
        return (d.getTitle() + " " + d.getDescription() + " " + d.getArea() + " " + d.getKind() + " "
                + d.getJurisdiction() + " " + value(d.getProductGroup()) + " " + value(d.getKeywords()) + " "
                + value(d.getDocumentNumber()) + " " + value(d.getSourceUrl()) + " " + value(d.getContent()))
                .toLowerCase(java.util.Locale.ROOT);
    }

    private static void apply(DocumentRecord d, DocumentRequest r, boolean creating) {
        d.setTitle(r.title().trim());
        d.setJurisdiction(r.jurisdiction());
        d.setKind(r.kind().trim());
        d.setArea(r.area().trim());
        d.setProductGroup(clean(r.productGroup()));
        d.setKeywords(clean(r.keywords()));
        d.setDocumentNumber(clean(r.documentNumber()));
        d.setDocumentDate(r.documentDate());
        d.setEffectiveFrom(r.effectiveFrom());
        d.setEffectiveUntil(r.effectiveUntil());
        d.setSourceUrl(normalizeUrl(r.sourceUrl()));
        d.setDescription(r.description().trim());
        d.setContent(r.content() == null ? "" : r.content().trim());
        if (r.effectiveFrom() != null && r.effectiveUntil() != null && r.effectiveUntil().isBefore(r.effectiveFrom())) {
            throw new IllegalArgumentException("Дата окончания действия не может быть раньше даты начала");
        }
        if (r.status() != null && !r.status().isBlank()) {
            try { d.setStatus(DocumentStatus.valueOf(r.status())); }
            catch (IllegalArgumentException ex) { throw new IllegalArgumentException("Недопустимый статус документа"); }
        } else if (creating) {
            d.setStatus(d.getSourceUrl() == null ? DocumentStatus.DRAFT : DocumentStatus.UNDER_REVIEW);
        }
        if (d.getStatus() == DocumentStatus.ACTIVE && d.getSourceUrl() == null) {
            throw new IllegalArgumentException("У действующего документа должен быть указан источник");
        }
    }

    private static void validate(DocumentRequest request) {
        if (request == null) throw new IllegalArgumentException("Не переданы данные документа");
        normalizeUrl(request.sourceUrl());
    }

    private static String normalizeUrl(String value) {
        String clean = clean(value);
        if (clean == null) return null;
        try {
            URI uri = URI.create(clean);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http"))
                    || uri.getHost() == null || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("Источник должен быть полноценной ссылкой HTTP или HTTPS");
            }
            return uri.normalize().toString();
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Некорректная ссылка на источник. Используйте HTTP или HTTPS");
        }
    }

    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static String text(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
    private static String value(String value) { return value == null ? "" : value; }

    public record ReviewRequest(String status, String note) {}
}