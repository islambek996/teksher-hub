package kg.teksherhub.document;

import java.time.Instant;
import java.time.LocalDate;

public record VersionResponse(
        Long id, int versionNumber, String title, String jurisdiction, String kind, String area,
        String documentNumber, LocalDate documentDate, LocalDate effectiveFrom, LocalDate effectiveUntil,
        String sourceUrl, String description, String status, String statusLabel,
        String changeNote, String changedBy, Instant createdAt
) {
    public static VersionResponse from(DocumentVersion v) {
        return new VersionResponse(v.getId(), v.getVersionNumber(), v.getTitle(), v.getJurisdiction(), v.getKind(),
                v.getArea(), v.getDocumentNumber(), v.getDocumentDate(), v.getEffectiveFrom(), v.getEffectiveUntil(),
                v.getSourceUrl(), v.getDescription(), v.getStatus().name(), v.getStatus().label(), v.getChangeNote(),
                v.getChangedBy(), v.getCreatedAt());
    }
}