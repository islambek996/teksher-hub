package kg.teksherhub.document;

import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) { this.service = service; }

    @GetMapping
    public List<DocumentResponse> list(@RequestParam(required = false) String q,
                                       @RequestParam(required = false) String jurisdiction,
                                       @RequestParam(required = false) String kind,
                                       @RequestParam(required = false) String status) {
        return service.list(q, jurisdiction, kind, status);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public DocumentResponse create(@Valid @RequestBody DocumentRequest request,
                                   @AuthenticationPrincipal UserAccount user) {
        return service.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public DocumentResponse update(@PathVariable UUID id, @Valid @RequestBody DocumentRequest request,
                                   @AuthenticationPrincipal UserAccount user) {
        return service.update(id, request, user.getUsername());
    }

    @PostMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public DocumentResponse review(@PathVariable UUID id, @RequestBody DocumentService.ReviewRequest request,
                                   @AuthenticationPrincipal UserAccount user) {
        return service.review(id, request, user.getUsername());
    }

    @GetMapping("/{id}/versions")
    public List<VersionResponse> versions(@PathVariable UUID id) { return service.history(id); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable UUID id) { service.delete(id); }
}