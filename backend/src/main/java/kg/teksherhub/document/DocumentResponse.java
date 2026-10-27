package kg.teksherhub.document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DocumentResponse(
        UUID id, String title, String jurisdiction, String kind, String area, String productGroup, String keywords,
        List<UUID> relatedDocumentIds,
        String documentNumber, LocalDate documentDate, LocalDate effectiveFrom, LocalDate effectiveUntil,
        String sourceUrl, String description, String content, String status, String statusLabel,
        Instant officialSourceCheckedAt, String sourceCheckNote,
        String createdBy, String updatedBy, Instant createdAt, Instant updatedAt, int versionNumber,
        long fileCount, boolean matchedInAttachment
) {
    public static DocumentResponse from(DocumentRecord d, long fileCount, List<UUID> relatedDocumentIds) {
        return from(d, fileCount, relatedDocumentIds, false);
    }

    public static DocumentResponse from(DocumentRecord d, long fileCount, List<UUID> relatedDocumentIds,
                                        boolean matchedInAttachment) {
        return new DocumentResponse(d.getId(), d.getTitle(), d.getJurisdiction(), d.getKind(), d.getArea(),
                d.getProductGroup(), d.getKeywords(), List.copyOf(relatedDocumentIds),
                d.getDocumentNumber(), d.getDocumentDate(), d.getEffectiveFrom(), d.getEffectiveUntil(),
                d.getSourceUrl(), d.getDescription(), d.getContent(), d.getStatus().name(), d.getStatus().label(),
                d.getOfficialSourceCheckedAt(), d.getSourceCheckNote(), d.getCreatedBy(), d.getUpdatedBy(),
                d.getCreatedAt(), d.getUpdatedAt(), d.getVersionNumber(), fileCount, matchedInAttachment);
    }

    public DocumentResponse withRelatedDocumentIds(List<UUID> visibleIds) {
        return new DocumentResponse(id, title, jurisdiction, kind, area, productGroup, keywords,
                List.copyOf(visibleIds), documentNumber, documentDate, effectiveFrom, effectiveUntil,
                sourceUrl, description, content, status, statusLabel, officialSourceCheckedAt,
                sourceCheckNote, createdBy, updatedBy, createdAt, updatedAt, versionNumber,
                fileCount, matchedInAttachment);
    }
}