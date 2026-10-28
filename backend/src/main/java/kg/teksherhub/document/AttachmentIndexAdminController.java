package kg.teksherhub.document;

import org.springframework.data.domain.PageRequest;
import kg.teksherhub.user.UserAccount;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.util.List;

/**
 * Admin-only endpoint for progressively indexing attachments saved before
 * automatic text extraction was introduced. Each request handles a bounded batch.
 */
@RestController
@RequestMapping("/api/admin/attachments")
public class AttachmentIndexAdminController {
    private static final String NOT_INDEXED = "NOT_INDEXED";
    private final DocumentFileRepository files;
    private final FileStorageService storage;
    private final DocumentTextExtractionService textExtraction;
    private final JdbcTemplate jdbc;

    public AttachmentIndexAdminController(DocumentFileRepository files, FileStorageService storage,
                                          DocumentTextExtractionService textExtraction, JdbcTemplate jdbc) {
        this.files = files;
        this.storage = storage;
        this.textExtraction = textExtraction;
        this.jdbc = jdbc;
    }

    @PostMapping("/reindex-unindexed")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public BatchReindexResponse reindexUnindexed(@RequestParam(defaultValue = "25") int limit,
                                                  @AuthenticationPrincipal UserAccount user) {
        int batchSize = Math.max(1, Math.min(limit, 50));
        List<DocumentFile> batch = files.findAllByTextExtractionStatusOrderByUploadedAtAsc(
                NOT_INDEXED, PageRequest.of(0, batchSize));

        int indexed = 0;
        int partiallyIndexed = 0;
        int emptyOrUnsupported = 0;
        int failed = 0;
        java.util.ArrayList<ReindexedFile> results = new java.util.ArrayList<>();

        for (DocumentFile file : batch) {
            try {
                var path = storage.resolve(file.getStoredName());
                DocumentTextExtractionService.ExtractionResult extracted;
                if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
                    extracted = new DocumentTextExtractionService.ExtractionResult("", "FAILED",
                            "Сохранённый файл отсутствует или недоступен для чтения.");
                } else {
                    extracted = textExtraction.extract(path, file.getOriginalName());
                }
                file.setExtractedText(extracted.text());
                file.setTextExtractionStatus(extracted.status());
                file.setTextExtractionNote(extracted.note());
                files.save(file);

                switch (extracted.status()) {
                    case "INDEXED", "OCR_INDEXED" -> indexed++;
                    case "TRUNCATED" -> partiallyIndexed++;
                    case "EMPTY", "NOT_SUPPORTED" -> emptyOrUnsupported++;
                    default -> failed++;
                }
                results.add(new ReindexedFile(file.getId(), file.getOriginalName(), extracted.status(),
                        extracted.text().length(), extracted.note()));
            } catch (RuntimeException ex) {
                file.setExtractedText("");
                file.setTextExtractionStatus("FAILED");
                file.setTextExtractionNote("Не удалось повторно проиндексировать вложение.");
                files.save(file);
                failed++;
                results.add(new ReindexedFile(file.getId(), file.getOriginalName(), "FAILED", 0,
                        file.getTextExtractionNote()));
            }
        }

        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'BATCH_REINDEX_ATTACHMENTS', 'DOCUMENT_FILE', NULL, 'Переиндексация вложений',
                        ?, NOW())
                """, user.getUsername(), "Обработано: " + batch.size() + "; успешно: " + indexed
                + "; частично: " + partiallyIndexed + "; пустые/неподдерживаемые: " + emptyOrUnsupported
                + "; ошибки: " + failed);
        return new BatchReindexResponse(batch.size(), indexed, partiallyIndexed, emptyOrUnsupported,
                failed, files.countByTextExtractionStatus(NOT_INDEXED), List.copyOf(results));
    }

    public record BatchReindexResponse(int processed, int indexed, int partiallyIndexed,
                                       int emptyOrUnsupported, int failed, long remainingUnindexed,
                                       List<ReindexedFile> files) {}

    public record ReindexedFile(java.util.UUID id, String originalName, String status,
                                int extractedCharacters, String note) {}
}
