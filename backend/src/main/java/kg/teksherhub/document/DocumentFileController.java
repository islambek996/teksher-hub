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

    public DocumentFileController(DocumentService documents, DocumentFileRepository files, FileStorageService storage) {
        this.documents = documents;
        this.files = files;
        this.storage = storage;
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
            return FileResponse.from(files.save(file));
        } catch (RuntimeException ex) {
            storage.delete(stored.storedName());
            throw ex;
        }
    }

    @GetMapping("/{fileId}/download")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> download(@PathVariable UUID documentId, @PathVariable UUID fileId) throws IOException {
        DocumentFile file = files.findByIdAndDocumentId(fileId, documentId).orElseThrow(() -> new IllegalArgumentException("Файл не найден"));
        var path = storage.resolve(file.getStoredName());
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists() || !resource.isReadable()) throw new IllegalArgumentException("Файл недоступен");
        MediaType type;
        try { type = MediaType.parseMediaType(file.getContentType()); }
        catch (Exception ex) { type = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok().contentType(type).contentLength(Files.size(path))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.getOriginalName(), StandardCharsets.UTF_8).build().toString())
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
                               String uploadedBy, java.time.Instant uploadedAt, String downloadPath) {
        static FileResponse from(DocumentFile f) {
            return new FileResponse(f.getId(), f.getOriginalName(), f.getContentType(), f.getSizeBytes(), f.getUploadedBy(),
                    f.getUploadedAt(), "/api/documents/" + f.getDocument().getId() + "/files/" + f.getId() + "/download");
        }
    }
}