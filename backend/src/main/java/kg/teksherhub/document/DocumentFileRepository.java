package kg.teksherhub.document;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentFileRepository extends JpaRepository<DocumentFile, UUID> {
    List<DocumentFile> findAllByDocumentIdOrderByUploadedAtDesc(UUID documentId);
    Optional<DocumentFile> findByIdAndDocumentId(UUID id, UUID documentId);
    long countByDocumentId(UUID documentId);
}