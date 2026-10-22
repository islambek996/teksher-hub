package kg.teksherhub.monitor;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SourceMonitorRequest(
        @NotBlank @Size(max = 180) String name,
        @NotBlank @Pattern(regexp = "RU|KG|EAEU") String jurisdiction,
        @NotBlank @Size(max = 2000) String sourceUrl,
        boolean enabled,
        @Min(1) @Max(720) int intervalHours
) {}