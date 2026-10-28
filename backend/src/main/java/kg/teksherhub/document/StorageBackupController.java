package kg.teksherhub.document;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/admin/storage")
public class StorageBackupController {
    private final Path uploadDirectory;

    public StorageBackupController(@Value("${app.storage.directory}") String directory) {
        this.uploadDirectory = Paths.get(directory).toAbsolutePath().normalize();
    }

    @GetMapping("/export.zip")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StreamingResponseBody> exportUploads() throws IOException {
        if (!Files.isDirectory(uploadDirectory) || !Files.isReadable(uploadDirectory)) {
            throw new IllegalStateException("Каталог загруженных файлов недоступен");
        }

        StreamingResponseBody body = output -> {
            try (ZipOutputStream zip = new ZipOutputStream(output);
                 var paths = Files.list(uploadDirectory)) {
                for (Path path : paths.filter(p -> Files.isRegularFile(p) && Files.isReadable(p))
                        .sorted(Comparator.comparing(p -> p.getFileName().toString())).toList()) {
                    ZipEntry entry = new ZipEntry(path.getFileName().toString());
                    zip.putNextEntry(entry);
                    try (var input = new BufferedInputStream(Files.newInputStream(path))) {
                        input.transferTo(zip);
                    }
                    zip.closeEntry();
                }
                zip.finish();
            }
        };

        String filename = "teksher-hub-uploads-" + LocalDate.now() + ".zip";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .header("Cache-Control", "no-store")
                .body(body);
    }
}
