package kg.teksherhub.document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record VersionResponse(
        Long id, int versionNumber, String title, String jurisdiction, String kind, String area,
        String productGroup, String keywords, List<UUID> relatedDocumentIds,
        String documentNumber, LocalDate documentDate, LocalDate effectiveFrom, LocalDate effectiveUntil,
        String sourceUrl, String description, String content, String status, String statusLabel,
        String changeNote, String changedBy, Instant createdAt
) {
    public static VersionResponse from(DocumentVersion v) {
        List<UUID> related = v.getRelatedDocumentIds() == null || v.getRelatedDocumentIds().isBlank()
                ? List.of()
                : Arrays.stream(v.getRelatedDocumentIds().split(",")).filter(s -> !s.isBlank()).map(UUID::fromString).toList();
        return new VersionResponse(v.getId(), v.getVersionNumber(), v.getTitle(), v.getJurisdiction(), v.getKind(),
                v.getArea(), v.getProductGroup(), v.getKeywords(), related, v.getDocumentNumber(), v.getDocumentDate(),
                v.getEffectiveFrom(), v.getEffectiveUntil(), v.getSourceUrl(), v.getDescription(), v.getContent(),
                v.getStatus().name(), v.getStatus().label(), v.getChangeNote(), v.getChangedBy(), v.getCreatedAt());
    }

    public VersionResponse withRelatedDocumentIds(List<UUID> visibleIds) {
        return new VersionResponse(id, versionNumber, title, jurisdiction, kind, area, productGroup, keywords,
                List.copyOf(visibleIds), documentNumber, documentDate, effectiveFrom, effectiveUntil,
                sourceUrl, description, content, status, statusLabel, changeNote, changedBy, createdAt);
    }
}