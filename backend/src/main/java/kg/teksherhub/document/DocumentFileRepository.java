package kg.teksherhub.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentFileRepository extends JpaRepository<DocumentFile, UUID> {
    List<DocumentFile> findAllByDocumentIdOrderByUploadedAtDesc(UUID documentId);
    Optional<DocumentFile> findByIdAndDocumentId(UUID id, UUID documentId);
    long countByDocumentId(UUID documentId);
    List<DocumentFile> findAllByTextExtractionStatusOrderByUploadedAtAsc(String status, Pageable pageable);
    long countByTextExtractionStatus(String status);

    @Query(value = "SELECT DISTINCT document_id FROM document_files WHERE STRPOS(LOWER(extracted_text), LOWER(:query)) > 0", nativeQuery = true)
    List<UUID> findDocumentIdsWithExtractedTextContaining(@Param("query") String query);
}