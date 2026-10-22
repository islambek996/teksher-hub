package kg.teksherhub.document;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "document_versions")
@Getter @Setter @NoArgsConstructor
public class DocumentVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;
    @Column(name = "version_number", nullable = false)
    private int versionNumber;
    @Column(nullable = false, length = 240)
    private String title;
    @Column(nullable = false, length = 10)
    private String jurisdiction;
    @Column(nullable = false, length = 60)
    private String kind;
    @Column(nullable = false, length = 120)
    private String area;
    @Column(name = "product_group", length = 160)
    private String productGroup;
    @Column(length = 1000)
    private String keywords;
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
    private DocumentStatus status;
    @Column(name = "change_note", length = 1000)
    private String changeNote;
    @Column(name = "changed_by", nullable = false, length = 120)
    private String changedBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static DocumentVersion snapshot(DocumentRecord doc, String username, String note) {
        DocumentVersion v = new DocumentVersion();
        v.setDocument(doc);
        v.setVersionNumber(doc.getVersionNumber());
        v.setTitle(doc.getTitle());
        v.setJurisdiction(doc.getJurisdiction());
        v.setKind(doc.getKind());
        v.setArea(doc.getArea());
        v.setProductGroup(doc.getProductGroup());
        v.setKeywords(doc.getKeywords());
        v.setDocumentNumber(doc.getDocumentNumber());
        v.setDocumentDate(doc.getDocumentDate());
        v.setEffectiveFrom(doc.getEffectiveFrom());
        v.setEffectiveUntil(doc.getEffectiveUntil());
        v.setSourceUrl(doc.getSourceUrl());
        v.setDescription(doc.getDescription());
        v.setStatus(doc.getStatus());
        v.setChangeNote(note);
        v.setChangedBy(username);
        v.setCreatedAt(Instant.now());
        return v;
    }
}