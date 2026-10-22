package kg.teksherhub.monitor;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SourceMonitorRepository extends JpaRepository<SourceMonitor, Long> {
    List<SourceMonitor> findAllByOrderByUpdatedAtDesc();
    List<SourceMonitor> findAllByEnabledTrue();
}