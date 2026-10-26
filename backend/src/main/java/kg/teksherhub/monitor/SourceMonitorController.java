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

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id, @AuthenticationPrincipal UserAccount user) {
        service.delete(id, user.getUsername());
    }
}