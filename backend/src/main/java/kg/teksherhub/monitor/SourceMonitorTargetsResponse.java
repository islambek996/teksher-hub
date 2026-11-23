package kg.teksherhub.monitor;

import java.util.List;
import java.util.UUID;

public record SourceMonitorTargetsResponse(
        List<DocumentTarget> documents,
        List<BusinessProcessTarget> businessProcesses
) {
    public record DocumentTarget(UUID id, String title, String jurisdiction, String kind, String status) {}
    public record BusinessProcessTarget(String id, String title, String workflowStatus) {}
}
