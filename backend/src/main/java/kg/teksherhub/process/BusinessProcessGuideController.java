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
    public List<BusinessProcessGuideResponse> list() {
        return service.list();
    }

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

    @GetMapping("/{id}/versions")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR','READER')")
    public List<BusinessProcessGuideService.GuideVersion> versions(@PathVariable String id) {
        return service.versions(id);
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
