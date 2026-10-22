package kg.teksherhub.document;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<DocumentRecord, UUID> {
    List<DocumentRecord> findAllByOrderByUpdatedAtDesc();
    List<DocumentRecord> findByEffectiveUntilBeforeAndStatus(LocalDate date, DocumentStatus status);
}