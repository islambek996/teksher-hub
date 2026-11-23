package kg.teksherhub.monitor;

import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitors")
public class SourceMonitorController {
    private final SourceMonitorService service;
    public SourceMonitorController(SourceMonitorService service) { this.service = service; }

    @GetMapping
    public List<SourceMonitorResponse> list() { return service.list(); }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorResponse create(@Valid @RequestBody SourceMonitorRequest request,
                                        @AuthenticationPrincipal UserAccount user) {
        return service.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorResponse update(@PathVariable Long id, @Valid @RequestBody SourceMonitorRequest request,
                                        @AuthenticationPrincipal UserAccount user) {
        return service.update(id, request, user.getUsername());
    }

    @PostMapping("/{id}/check")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorResponse check(@PathVariable Long id, @AuthenticationPrincipal UserAccount user) {
        return service.checkNow(id, user.getUsername());
    }


    @GetMapping("/{id}/targets")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorTargetsResponse targets(@PathVariable Long id) {
        return service.targets(id);
    }

    @PutMapping("/{id}/targets")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorTargetsResponse replaceTargets(@PathVariable Long id,
            @Valid @RequestBody SourceMonitorTargetsRequest request,
            @AuthenticationPrincipal UserAccount user) {
        return service.replaceTargets(id, request, user.getUsername());
    }

    @GetMapping("/{id}/changes")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public List<SourceMonitorChangeResponse> changes(@PathVariable Long id) {
        return service.changes(id);
    }

    @PostMapping("/{id}/changes/{changeId}/acknowledge")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public SourceMonitorChangeResponse acknowledgeChange(@PathVariable Long id, @PathVariable Long changeId,
            @RequestBody(required = false) ChangeReviewRequest request,
            @AuthenticationPrincipal UserAccount user) {
        return service.acknowledgeChange(id, changeId, request == null ? null : request.note(), user.getUsername());
    }

    public record ChangeReviewRequest(String note) {}

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal UserAccount user) {
        service.delete(id, user.getUsername());
    }
}