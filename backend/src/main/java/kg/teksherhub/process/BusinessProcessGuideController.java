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

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
