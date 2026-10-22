package kg.teksherhub.monitor;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "source_monitors")
@Getter @Setter @NoArgsConstructor
public class SourceMonitor {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 180)
    private String name;
    @Column(nullable = false, length = 10)
    private String jurisdiction;
    @Column(name = "source_url", nullable = false, columnDefinition = "text")
    private String sourceUrl;
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(name = "interval_hours", nullable = false)
    private int intervalHours = 24;
    @Column(name = "last_checked_at")
    private Instant lastCheckedAt;
    @Column(name = "last_http_status")
    private Integer lastHttpStatus;
    @Column(name = "last_content_hash", length = 128)
    private String lastContentHash;
    @Column(name = "last_change_detected_at")
    private Instant lastChangeDetectedAt;
    @Column(name = "last_error", length = 1000)
    private String lastError;
    @Column(name = "created_by", nullable = false, length = 120)
    private String createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}