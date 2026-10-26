package kg.teksherhub.document;

import kg.teksherhub.user.UserAccount;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents/{documentId}/files")
public class DocumentFileController {
    private final DocumentService documents;
    private final DocumentFileRepository files;
    private final FileStorageService storage;
    private final DocumentTextExtractionService textExtraction;

    public DocumentFileController(DocumentService documents, DocumentFileRepository files, FileStorageService storage,
                                  DocumentTextExtractionService textExtraction) {
        this.documents = documents;
        this.files = files;
        this.storage = storage;
        this.textExtraction = textExtraction;
    }

    @GetMapping
    public List<FileResponse> list(@PathVariable UUID documentId) {
        documents.findEntity(documentId);
        return files.findAllByDocumentIdOrderByUploadedAtDesc(documentId).stream().map(FileResponse::from).toList();
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    @Transactional
    public FileResponse upload(@PathVariable UUID documentId, @RequestParam("file") MultipartFile upload,
                               @AuthenticationPrincipal UserAccount user) {
        DocumentRecord doc = documents.findEntity(documentId);
        FileStorageService.StoredFile stored = storage.store(upload);
        try {
            DocumentFile file = new DocumentFile();
            file.setDocument(doc);
            file.setOriginalName(stored.originalName());
            file.setStoredName(stored.storedName());
            file.setContentType(stored.contentType());
            file.setSizeBytes(stored.sizeBytes());
            file.setUploadedBy(user.getUsername());
            DocumentTextExtractionService.ExtractionResult extracted = textExtraction.extract(stored.path(), stored.originalName());
            file.setExtractedText(extracted.text());
            file.setTextExtractionStatus(extracted.status());
            file.setTextExtractionNote(extracted.note());
            return FileResponse.from(files.save(file));
        } catch (RuntimeException ex) {
            storage.delete(stored.storedName());
            throw ex;
        }
    }

    @PostMapping("/{fileId}/reindex")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    @Transactional
    public FileResponse reindex(@PathVariable UUID documentId, @PathVariable UUID fileId) {
        DocumentFile file = files.findByIdAndDocumentId(fileId, documentId)
                .orElseThrow(() -> new IllegalArgumentException("Файл не найден"));
        var path = storage.resolve(file.getStoredName());
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new IllegalArgumentException("Файл недоступен для индексации");
        }
        DocumentTextExtractionService.ExtractionResult extracted =
                textExtraction.extract(path, file.getOriginalName());
        file.setExtractedText(extracted.text());
        file.setTextExtractionStatus(extracted.status());
        file.setTextExtractionNote(extracted.note());
        return FileResponse.from(files.save(file));
    }

    @GetMapping("/{fileId}/download")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> download(@PathVariable UUID documentId, @PathVariable UUID fileId) throws IOException {
        DocumentFile file = files.findByIdAndDocumentId(fileId, documentId).orElseThrow(() -> new IllegalArgumentException("Файл не найден"));
        var path = storage.resolve(file.getStoredName());
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists() || !resource.isReadable()) throw new IllegalArgumentException("Файл недоступен");
        // The stored content type originates from the client upload and is not trustworthy.
        // Downloads are always served as binary attachments to prevent browser MIME sniffing.
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(Files.size(path))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.getOriginalName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(resource);
    }

    @DeleteMapping("/{fileId}")
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    @Transactional
    public void delete(@PathVariable UUID documentId, @PathVariable UUID fileId) {
        DocumentFile file = files.findByIdAndDocumentId(fileId, documentId).orElseThrow(() -> new IllegalArgumentException("Файл не найден"));
        files.delete(file);
        storage.delete(file.getStoredName());
    }

    public record FileResponse(UUID id, String originalName, String contentType, long sizeBytes,
                               String uploadedBy, java.time.Instant uploadedAt,
                               String textExtractionStatus, String textExtractionNote, int extractedCharacters,
                               String downloadPath) {
        static FileResponse from(DocumentFile f) {
            String extracted = f.getExtractedText();
            return new FileResponse(f.getId(), f.getOriginalName(), f.getContentType(), f.getSizeBytes(), f.getUploadedBy(),
                    f.getUploadedAt(), f.getTextExtractionStatus(), f.getTextExtractionNote(),
                    extracted == null ? 0 : extracted.length(),
                    "/api/documents/" + f.getDocument().getId() + "/files/" + f.getId() + "/download");
        }
    }
}