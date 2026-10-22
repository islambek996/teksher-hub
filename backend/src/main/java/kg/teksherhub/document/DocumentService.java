package kg.teksherhub.document;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {
    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentFileRepository files;
    private final FileStorageService storage;

    public DocumentService(DocumentRepository documents, DocumentVersionRepository versions, DocumentFileRepository files, FileStorageService storage) {
        this.documents = documents;
        this.versions = versions;
        this.files = files;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(String query, String jurisdiction, String kind, String status) {
        String q = query == null ? "" : query.trim().toLowerCase();
        return documents.findAllByOrderByUpdatedAtDesc().stream()
                .filter(d -> q.isBlank() || searchable(d).contains(q))
                .filter(d -> jurisdiction == null || jurisdiction.isBlank() || jurisdiction.equalsIgnoreCase(d.getJurisdiction()))
                .filter(d -> kind == null || kind.isBlank() || kind.equalsIgnoreCase(d.getKind()))
                .filter(d -> status == null || status.isBlank() || status.equalsIgnoreCase(d.getStatus().name()))
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(UUID id) { return toResponse(findEntity(id)); }

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
        versions.save(DocumentVersion.snapshot(d, username, text(request.changeNote(), "Создание карточки")));
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
        versions.save(DocumentVersion.snapshot(d, username, text(request.changeNote(), "Обновление карточки")));
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
        if (next == DocumentStatus.DRAFT && d.getOfficialSourceCheckedAt() != null) {
            d.setOfficialSourceCheckedAt(null);
        } else {
            d.setOfficialSourceCheckedAt(Instant.now());
        }
        d.setStatus(next);
        d.setSourceCheckNote(text(request.note(), "Проверено вручную"));
        d.setUpdatedBy(username);
        d.setUpdatedAt(Instant.now());
        d.setVersionNumber(d.getVersionNumber() + 1);
        d = documents.save(d);
        versions.save(DocumentVersion.snapshot(d, username, "Проверка актуальности: " + d.getStatus().label()));
        return toResponse(d);
    }

    @Transactional
    public void delete(UUID id) {
        DocumentRecord d = findEntity(id);
        for (DocumentFile file : files.findAllByDocumentIdOrderByUploadedAtDesc(id)) {
            storage.delete(file.getStoredName());
        }
        documents.delete(d);
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
            versions.save(DocumentVersion.snapshot(d, "system-expiry-job", "Автоматически отмечено по дате окончания действия"));
        }
        return due.size();
    }

    public DocumentRecord findEntity(UUID id) {
        return documents.findById(id).orElseThrow(() -> new IllegalArgumentException("Документ не найден"));
    }

    private DocumentResponse toResponse(DocumentRecord d) {
        return DocumentResponse.from(d, files.countByDocumentId(d.getId()));
    }

    private static String searchable(DocumentRecord d) {
        return (d.getTitle() + " " + d.getDescription() + " " + d.getArea() + " " + d.getKind() + " "
                + d.getJurisdiction() + " " + value(d.getDocumentNumber()) + " " + value(d.getSourceUrl())).toLowerCase();
    }

    private static void apply(DocumentRecord d, DocumentRequest r, boolean creating) {
        d.setTitle(r.title().trim());
        d.setJurisdiction(r.jurisdiction());
        d.setKind(r.kind().trim());
        d.setArea(r.area().trim());
        d.setDocumentNumber(clean(r.documentNumber()));
        d.setDocumentDate(r.documentDate());
        d.setEffectiveFrom(r.effectiveFrom());
        d.setEffectiveUntil(r.effectiveUntil());
        d.setSourceUrl(normalizeUrl(r.sourceUrl()));
        d.setDescription(r.description().trim());
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