package kg.teksherhub.process;

import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/business-processes/{processId}/progress")
public class ProcessProgressController {
    private final TeamCollaborationService service;
    public ProcessProgressController(TeamCollaborationService service) { this.service = service; }
    @GetMapping public ProcessProgressResponse get(@PathVariable String processId, @AuthenticationPrincipal UserAccount user) {
        return new ProcessProgressResponse(processId, service.getProgress(user.getUsername(), processId));
    }
    @PutMapping public ProcessProgressResponse save(@PathVariable String processId, @Valid @RequestBody ProcessProgressRequest request, @AuthenticationPrincipal UserAccount user) {
        return new ProcessProgressResponse(processId, service.saveProgress(user.getUsername(), processId, request.completedSteps()));
    }
    public record ProcessProgressRequest(@NotNull @Size(max = 30) List<@NotNull Integer> completedSteps) {}
    public record ProcessProgressResponse(String processId, List<Integer> completedSteps) {}
}
