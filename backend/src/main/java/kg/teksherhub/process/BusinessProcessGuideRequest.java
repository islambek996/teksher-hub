package kg.teksherhub.process;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BusinessProcessGuideRequest(
        @NotBlank @Size(max = 120) String category,
        @NotBlank @Size(max = 240) String title,
        @NotBlank @Size(max = 1500) String summary,
        @NotBlank @Size(max = 160) String scope,
        @NotBlank @Size(max = 120) String time,
        @NotBlank @Size(max = 200) String searchTerm,
        @Size(max = 10) List<@Valid BusinessProcessSource> sources,
        @NotEmpty @Size(max = 30) List<@Valid BusinessProcessStep> steps,
        Integer orderIndex
) {}
