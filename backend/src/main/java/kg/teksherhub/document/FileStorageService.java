package kg.teksherhub.document;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {
    private static final long MAX_BYTES = 30L * 1024 * 1024;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg");
    private final Path root;

    public FileStorageService(@Value("${app.storage.directory}") String directory) {
        this.root = Paths.get(directory).toAbsolutePath().normalize();
        try { Files.createDirectories(root); }
        catch (IOException ex) { throw new IllegalStateException("Не удалось создать каталог загрузок", ex); }
    }

    public StoredFile store(MultipartFile upload) {
        if (upload == null || upload.isEmpty()) throw new IllegalArgumentException("Выберите файл для загрузки");
        if (upload.getSize() > MAX_BYTES) throw new IllegalArgumentException("Максимальный размер файла – 30 МБ");
        String original = StringUtils.cleanPath(upload.getOriginalFilename() == null ? "document" : upload.getOriginalFilename());
        if (original.contains("..") || original.contains("/") || original.contains("\\")) throw new IllegalArgumentException("Некорректное имя файла");
        int dot = original.lastIndexOf('.');
        String extension = dot > 0 && dot < original.length() - 1 ? original.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_EXTENSIONS.contains(extension)) throw new IllegalArgumentException("Разрешены PDF, Word, Excel, CSV, TXT и изображения PNG/JPG");
        String baseName = original.replaceAll("[^A-Za-zА-Яа-я0-9._ -]", "_");
        if (baseName.length() > 250) baseName = baseName.substring(baseName.length() - 250);
        String stored = UUID.randomUUID() + "." + extension;
        Path target = resolve(stored);
        try (var input = upload.getInputStream()) { Files.copy(input, target); }
        catch (IOException ex) { throw new IllegalStateException("Не удалось сохранить файл", ex); }
        String contentType = upload.getContentType();
        if (contentType == null || contentType.isBlank() || contentType.length() > 160) contentType = "application/octet-stream";
        return new StoredFile(baseName, stored, contentType, upload.getSize(), target);
    }

    public Path resolve(String storedName) {
        Path resolved = root.resolve(storedName).normalize();
        if (!resolved.startsWith(root) || storedName.contains("/") || storedName.contains("\\")) throw new IllegalArgumentException("Некорректный путь файла");
        return resolved;
    }

    public void delete(String storedName) {
        try { Files.deleteIfExists(resolve(storedName)); }
        catch (IOException ex) { throw new IllegalStateException("Не удалось удалить файл с диска", ex); }
    }

    public record StoredFile(String originalName, String storedName, String contentType, long sizeBytes, Path path) {}
}