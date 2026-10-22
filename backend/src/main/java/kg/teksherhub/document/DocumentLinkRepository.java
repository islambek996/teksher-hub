package kg.teksherhub.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DocumentLinkRepository extends JpaRepository<DocumentLink, DocumentLinkId> {
    @Query("select l.relatedDocument.id from DocumentLink l where l.document.id = :documentId")
    List<UUID> findRelatedIdsByDocumentId(@Param("documentId") UUID documentId);
    void deleteAllByDocumentId(UUID documentId);
}