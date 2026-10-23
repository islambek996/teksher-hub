package kg.teksherhub.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import kg.teksherhub.ai.AiAssistantService.AssistantResponse;
import kg.teksherhub.ai.AiAssistantService.SourceReference;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiAssistantController {
    private final AiAssistantService service;

    public AiAssistantController(AiAssistantService service) {
        this.service = service;
    }

    @PostMapping("/ask")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public AssistantResponse ask(@Valid @RequestBody AskRequest request) {
        return service.ask(request.question());
    }

    public record AskRequest(@NotBlank @Size(max = 2000) String question) {}
}
