package kg.teksherhub.process;

import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/business-processes")
public class BusinessProcessGuideController {
    private final BusinessProcessGuideService service;

    public BusinessProcessGuideController(BusinessProcessGuideService service) {
        this.service = service;
    }

    @GetMapping
    public List<BusinessProcessGuideResponse> list(@AuthenticationPrincipal UserAccount user) {
        if (user != null && ("ADMIN".equals(user.getRole()) || "EDITOR".equals(user.getRole()))) {
            return service.list();
        }
        return service.publishedList();
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BusinessProcessGuideService.WorkflowOverview overview() {
        return service.overview();
    }

    @PostMapping("/{id}/submit-for-review")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BusinessProcessGuideResponse submitForReview(@PathVariable String id,
            @AuthenticationPrincipal UserAccount user) {
        return service.submitForReview(id, user.getUsername());
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    public BusinessProcessGuideResponse publish(@PathVariable String id,
            @AuthenticationPrincipal UserAccount user) {
        return service.publish(id, user.getUsername());
    }

    @PostMapping("/{id}/return-for-revision")
    @PreAuthorize("hasRole('ADMIN')")
    public BusinessProcessGuideResponse returnForRevision(@PathVariable String id,
            @RequestBody(required = false) WorkflowCommentRequest request,
            @AuthenticationPrincipal UserAccount user) {
        return service.returnForRevision(id, request == null ? null : request.comment(), user.getUsername());
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public BusinessProcessGuideResponse archive(@PathVariable String id,
            @AuthenticationPrincipal UserAccount user) {
        return service.archive(id, user.getUsername());
    }

    @PostMapping("/{id}/restore-archived")
    @PreAuthorize("hasRole('ADMIN')")
    public BusinessProcessGuideResponse restoreArchived(@PathVariable String id,
            @AuthenticationPrincipal UserAccount user) {
        return service.restoreArchived(id, user.getUsername());
    }

    public record WorkflowCommentRequest(String comment) {}


    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BusinessProcessGuideResponse create(@Valid @RequestBody BusinessProcessGuideRequest request,
                                               @AuthenticationPrincipal UserAccount user) {
        return service.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BusinessProcessGuideResponse update(@PathVariable String id,
                                               @Valid @RequestBody BusinessProcessGuideRequest request,
                                               @AuthenticationPrincipal UserAccount user) {
        return service.update(id, request, user.getUsername());
    }

    @GetMapping("/deleted")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public List<BusinessProcessGuideService.DeletedGuide> deletedGuides() {
        return service.deletedGuides();
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public List<BusinessProcessGuideService.GuideVersion> versions(@PathVariable String id) {
        return service.versions(id);
    }

    @GetMapping("/{id}/versions/{versionNumber}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public BusinessProcessGuideResponse versionDetail(@PathVariable String id, @PathVariable int versionNumber) {
        return service.versionDetail(id, versionNumber);
    }

    @PostMapping("/{id}/versions/{versionNumber}/restore")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BusinessProcessGuideResponse restore(@PathVariable String id, @PathVariable int versionNumber,
                                                @AuthenticationPrincipal UserAccount user) {
        return service.restore(id, versionNumber, user.getUsername());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id, @AuthenticationPrincipal UserAccount user) {
        service.delete(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
