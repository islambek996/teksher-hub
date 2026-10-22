package kg.teksherhub.document;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "documents")
@Getter @Setter @NoArgsConstructor
public class DocumentRecord {
    @Id
    private UUID id = UUID.randomUUID();
    @Column(nullable = false, length = 240)
    private String title;
    @Column(nullable = false, length = 10)
    private String jurisdiction;
    @Column(nullable = false, length = 60)
    private String kind;
    @Column(nullable = false, length = 120)
    private String area;
    @Column(name = "document_number", length = 120)
    private String documentNumber;
    @Column(name = "document_date")
    private LocalDate documentDate;
    @Column(name = "effective_from")
    private LocalDate effectiveFrom;
    @Column(name = "effective_until")
    private LocalDate effectiveUntil;
    @Column(name = "source_url", columnDefinition = "text")
    private String sourceUrl;
    @Column(nullable = false, length = 3000)
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private DocumentStatus status = DocumentStatus.DRAFT;
    @Column(name = "official_source_checked_at")
    private Instant officialSourceCheckedAt;
    @Column(name = "source_check_note", length = 1000)
    private String sourceCheckNote;
    @Column(name = "created_by", nullable = false, length = 120)
    private String createdBy;
    @Column(name = "updated_by", nullable = false, length = 120)
    private String updatedBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
    @Column(name = "version_number", nullable = false)
    private int versionNumber = 1;
}