package kg.teksherhub.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DocumentRequest(
        @NotBlank @Size(max = 240) String title,
        @NotBlank @Pattern(regexp = "RU|KG|EAEU") String jurisdiction,
        @NotBlank @Size(max = 60) String kind,
        @NotBlank @Size(max = 120) String area,
        @Size(max = 160) String productGroup,
        @Size(max = 1000) String keywords,
        @Size(max = 100) List<UUID> relatedDocumentIds,
        @Size(max = 120) String documentNumber,
        LocalDate documentDate,
        LocalDate effectiveFrom,
        LocalDate effectiveUntil,
        @Size(max = 2000) String sourceUrl,
        @NotBlank @Size(max = 3000) String description,
        @Size(max = 50000) String content,
        @Pattern(regexp = "|DRAFT|UNDER_REVIEW|ACTIVE|EXPIRED|ARCHIVED") String status,
        @Size(max = 1000) String changeNote
) {}