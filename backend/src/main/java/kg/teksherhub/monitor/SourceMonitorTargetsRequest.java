package kg.teksherhub.monitor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record SourceMonitorTargetsRequest(
        @Size(max = 200) List<UUID> documentIds,
        @Size(max = 200) List<@NotBlank @Size(max = 80) String> processIds
) {}
