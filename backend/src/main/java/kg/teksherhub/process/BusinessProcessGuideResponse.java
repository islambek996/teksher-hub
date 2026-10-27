package kg.teksherhub.process;

import java.time.Instant;
import java.util.List;

public record BusinessProcessGuideResponse(
        String id,
        String category,
        String title,
        String summary,
        String scope,
        String time,
        String searchTerm,
        List<BusinessProcessSource> sources,
        List<BusinessProcessStep> steps,
        int orderIndex,
        String createdBy,
        String updatedBy,
        Instant updatedAt,
        String workflowStatus,
        String reviewComment,
        Instant submittedAt,
        String approvedBy,
        Instant approvedAt,
        Instant archivedAt
) {}
