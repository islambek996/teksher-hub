package kg.teksherhub.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import kg.teksherhub.ai.AiAssistantService.AssistantResponse;\nimport kg.teksherhub.ai.AiAssistantService.ChatTurn;
import kg.teksherhub.ai.AiAssistantService.SourceReference;
import org.springframework.security.access.prepost.PreAuthorize;\nimport org.slf4j.Logger;\nimport org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AiAssistantController {\n    private static final Logger log = LoggerFactory.getLogger(AiAssistantController.class);
    private final AiAssistantService service;

    public AiAssistantController(AiAssistantService service) {
        this.service = service;
    }

    @PostMapping("/ask")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public AssistantResponse ask(@Valid @RequestBody AskRequest request) {
        return service.ask(request.question(), request.history());
    }

    @PostMapping("/feedback")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public FeedbackResponse feedback(@Valid @RequestBody FeedbackRequest request) {
        log.info("AI feedback received: rating={}, category={}", request.rating(), request.category());
        return new FeedbackResponse(true, "Спасибо за оценку!");
    }

    public record FeedbackRequest(@NotBlank @Size(max = 40) String rating,
                                  @Size(max = 80) String category) {}
    public record FeedbackResponse(boolean received, String message) {}

    public record AskRequest(@NotBlank @Size(max = 2000) String question, @Size(max = 8) List<ChatTurn> history) {}
}
