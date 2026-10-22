package kg.teksherhub.document;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "document_links")
@Getter @Setter @NoArgsConstructor
public class DocumentLink {
    @EmbeddedId
    private DocumentLinkId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("documentId")
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("relatedDocumentId")
    @JoinColumn(name = "related_document_id", nullable = false)
    private DocumentRecord relatedDocument;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}