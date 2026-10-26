package kg.teksherhub.document;

import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

import java.util.List;
import java.util.ArrayList;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);
    private final DocumentService service;
    private final DocumentImportService importer;

    public DocumentController(DocumentService service, DocumentImportService importer) {
        this.service = service;
        this.importer = importer;
    }

    @GetMapping
    public List<DocumentResponse> list(@RequestParam(required = false) String q,
                                       @RequestParam(required = false) String jurisdiction,
                                       @RequestParam(required = false) String kind,
                                       @RequestParam(required = false) String status) {
        return service.list(q, jurisdiction, kind, status);
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public ResponseEntity<byte[]> exportCsv() {
        byte[] csv = service.exportCsv();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("teksher-hub-export.csv", StandardCharsets.UTF_8).build().toString())
                .body(csv);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public DocumentResponse create(@Valid @RequestBody DocumentRequest request,
                                   @AuthenticationPrincipal UserAccount user) {
        return service.create(request, user.getUsername());
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public BulkImportResponse importDocuments(@Valid @RequestBody BulkImportRequest request,
                                              @AuthenticationPrincipal UserAccount user) {
        List<ImportRowResult> results = new ArrayList<>();
        int rowNumber = 1;
        for (DocumentRequest item : request.documents()) {
            rowNumber++;
            String title = item == null ? "" : item.title();
            try {
                DocumentResponse imported = importer.importOne(item, user.getUsername(), rowNumber);
                results.add(new ImportRowResult(rowNumber, title, true, imported.id(),
                        imported.statusLabel(), "Добавлено в общую базу"));
            } catch (IllegalArgumentException ex) {
                String message = ex.getMessage();
                results.add(new ImportRowResult(rowNumber, title, false, null, null,
                        message == null || message.isBlank() ? "Некорректные данные строки" : message));
            } catch (Exception ex) {
                log.error("Unexpected error importing document batch row {}", rowNumber, ex);
                results.add(new ImportRowResult(rowNumber, title, false, null, null,
                        "Внутренняя ошибка при импорте строки. Повторите попытку позже."));
            }
        }
        int imported = (int) results.stream().filter(ImportRowResult::imported).count();
        return new BulkImportResponse(imported, results.size() - imported, List.copyOf(results));
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
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal UserAccount user) {
        service.delete(id, user.getUsername());
    }

    public record BulkImportRequest(
            @NotEmpty @Size(max = 100) List<DocumentRequest> documents
    ) {}

    public record BulkImportResponse(int imported, int rejected, List<ImportRowResult> rows) {}

    public record ImportRowResult(int rowNumber, String title, boolean imported, UUID documentId,
                                  String statusLabel, String message) {}
}