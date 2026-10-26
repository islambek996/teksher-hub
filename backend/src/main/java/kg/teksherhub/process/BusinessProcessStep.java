package kg.teksherhub.process;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BusinessProcessStep(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 4000) String detail
) {}
