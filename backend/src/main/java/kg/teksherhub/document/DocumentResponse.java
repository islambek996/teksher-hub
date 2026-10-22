package kg.teksherhub.document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DocumentResponse(
        UUID id, String title, String jurisdiction, String kind, String area,
        String documentNumber, LocalDate documentDate, LocalDate effectiveFrom, LocalDate effectiveUntil,
        String sourceUrl, String description, String status, String statusLabel,
        Instant officialSourceCheckedAt, String sourceCheckNote,
        String createdBy, String updatedBy, Instant createdAt, Instant updatedAt, int versionNumber,
        long fileCount
) {
    public static DocumentResponse from(DocumentRecord d, long fileCount) {
        return new DocumentResponse(d.getId(), d.getTitle(), d.getJurisdiction(), d.getKind(), d.getArea(),
                d.getDocumentNumber(), d.getDocumentDate(), d.getEffectiveFrom(), d.getEffectiveUntil(),
                d.getSourceUrl(), d.getDescription(), d.getStatus().name(), d.getStatus().label(),
                d.getOfficialSourceCheckedAt(), d.getSourceCheckNote(), d.getCreatedBy(), d.getUpdatedBy(),
                d.getCreatedAt(), d.getUpdatedAt(), d.getVersionNumber(), fileCount);
    }
}