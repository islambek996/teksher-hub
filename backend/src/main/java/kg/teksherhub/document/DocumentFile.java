package kg.teksherhub.document;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_files")
@Getter @Setter @NoArgsConstructor
public class DocumentFile {
    @Id
    private UUID id = UUID.randomUUID();
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;
    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;
    @Column(name = "stored_name", nullable = false, unique = true, length = 255)
    private String storedName;
    @Column(name = "content_type", nullable = false, length = 160)
    private String contentType;
    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;
    @Column(name = "uploaded_by", nullable = false, length = 120)
    private String uploadedBy;
    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt = Instant.now();
}