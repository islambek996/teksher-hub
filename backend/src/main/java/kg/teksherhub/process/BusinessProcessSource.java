package kg.teksherhub.process;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record BusinessProcessSource(
        @NotBlank @Size(max = 200) String label,
        @NotBlank @Size(max = 2000) @Pattern(regexp = "^https?://.+$", message = "Ссылка должна начинаться с http:// или https://") String url
) {}
