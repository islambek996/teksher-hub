package kg.teksherhub.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import kg.teksherhub.ai.AiAssistantService.AssistantResponse;
import kg.teksherhub.ai.AiAssistantService.ChatTurn;
import kg.teksherhub.user.UserAccount;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
public class AiAssistantController {
    private final AiAssistantService service;
    private final AiAnswerFeedbackRepository feedbackRepository;

    public AiAssistantController(AiAssistantService service, AiAnswerFeedbackRepository feedbackRepository) {
        this.service = service;
        this.feedbackRepository = feedbackRepository;
    }

    @PostMapping("/ask")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public AssistantResponse ask(@Valid @RequestBody AskRequest request) {
        return service.ask(request.question(), request.history());
    }

    @PostMapping("/feedback")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public FeedbackResponse feedback(@Valid @RequestBody FeedbackRequest request,
                                     @AuthenticationPrincipal UserAccount user) {
        String rating = request.rating().trim().toLowerCase(Locale.ROOT);
        AiAnswerFeedback feedback = new AiAnswerFeedback();
        feedback.setRating(rating);
        feedback.setCategory(safe(request.category(), 80));
        feedback.setUsername(user == null ? null : safe(user.getUsername(), 120));
        feedback.setQuestionText(safe(request.question(), 2_000));
        feedback.setAnswerText(safe(request.answer(), 8_000));
        feedback.setSourceTitles(request.sourceTitles() == null ? "" : request.sourceTitles().stream()
                .filter(title -> title != null && !title.isBlank())
                .limit(6)
                .map(title -> safe(title, 240))
                .filter(title -> !title.isBlank())
                .collect(Collectors.joining("\\n")));
        AiAnswerFeedback saved = feedbackRepository.save(feedback);
        return new FeedbackResponse(true, "Спасибо за оценку!", saved.getId());
    }

    @GetMapping("/feedback/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public FeedbackSummary feedbackSummary() {
        List<FeedbackItem> recentNegative = feedbackRepository.findTop10ByRatingOrderByCreatedAtDesc("negative")
                .stream()
                .map(item -> new FeedbackItem(item.getId(), item.getUsername(), item.getCategory(),
                        item.getQuestionText(), item.getAnswerText(), item.getSourceTitles(), item.getCreatedAt()))
                .toList();
        return new FeedbackSummary(feedbackRepository.count(), feedbackRepository.countByRating("positive"),
                feedbackRepository.countByRating("negative"), recentNegative);
    }

    private static String safe(String value, int maxLength) {
        if (value == null || value.isBlank()) return "";
        String cleaned = value.replace(String.valueOf((char) 0), "").trim();
        return cleaned.length() <= maxLength ? cleaned : cleaned.substring(0, maxLength);
    }

    public record FeedbackRequest(
            @NotBlank @Pattern(regexp = "positive|negative") String rating,
            @Size(max = 80) @Pattern(regexp = "answer|incorrect|no_source|outdated|unclear|other") String category,
            @Size(max = 2_000) String question,
            @Size(max = 8_000) String answer,
            @Size(max = 6) List<@Size(max = 240) String> sourceTitles) {}
    public record FeedbackResponse(boolean received, String message, Long id) {}
    public record FeedbackItem(Long id, String username, String category, String question, String answer,
                               String sourceTitles, Instant createdAt) {}
    public record FeedbackSummary(long total, long positive, long negative, List<FeedbackItem> recentNegative) {}

    public record AskRequest(@NotBlank @Size(max = 2_000) String question,
                             @Size(max = 8) List<ChatTurn> history) {}
}
