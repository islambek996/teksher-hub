package kg.teksherhub.process;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BusinessProcessStep(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 4000) String detail,
        @Size(max = 160) String responsible,
        @Size(max = 2000) String documents,
        @Size(max = 500) String decision,
        @Size(max = 500) String yesOutcome,
        @Size(max = 500) String noOutcome,
        Integer yesStepIndex,
        Integer noStepIndex
) {}
