package kg.teksherhub.process;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "business_process_guides")
@Getter
@Setter
@NoArgsConstructor
public class BusinessProcessGuide {
    @Id
    @Column(length = 80, nullable = false)
    private String id;

    @Column(nullable = false, length = 120)
    private String category;

    @Column(nullable = false, length = 240)
    private String title;

    @Column(nullable = false, length = 1500)
    private String summary;

    @Column(nullable = false, length = 160)
    private String scope;

    @Column(name = "time_label", nullable = false, length = 120)
    private String time;

    @Column(name = "search_term", nullable = false, length = 200)
    private String searchTerm;

    @Column(name = "sources_json", nullable = false, columnDefinition = "text")
    private String sourcesJson = "[]";

    @Column(name = "steps_json", nullable = false, columnDefinition = "text")
    private String stepsJson = "[]";

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "workflow_status", nullable = false, length = 24)
    private String workflowStatus = "PUBLISHED";

    @Column(name = "review_comment", length = 1000)
    private String reviewComment;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "approved_by", length = 120)
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "created_by", nullable = false, length = 120)
    private String createdBy;

    @Column(name = "updated_by", nullable = false, length = 120)
    private String updatedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
