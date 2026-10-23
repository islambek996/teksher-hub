package kg.teksherhub.document;

import org.apache.tika.config.OutputLimits;
import org.apache.tika.exception.WriteLimitReachedException;
import org.apache.tika.io.TikaInputStream;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

/**
 * Extracts a bounded text index from supported office and text attachments.
 * Image OCR is intentionally not enabled: an image-only PDF can have no searchable text.
 */
@Service
public class DocumentTextExtractionService {
    private static final Logger log = LoggerFactory.getLogger(DocumentTextExtractionService.class);
    private static final int MAX_EXTRACTED_CHARACTERS = 100_000;
    private static final Set<String> SUPPORTED_EXTENSIONS =
            Set.of("pdf", "doc", "docx", "xls", "xlsx", "txt", "csv");

    public ExtractionResult extract(Path path, String originalName) {
        String extension = extensionOf(originalName);
        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            return new ExtractionResult("", "NOT_SUPPORTED",
                    "Автоматическое извлечение текста из этого формата не поддерживается. Для изображений нужен OCR.");
        }

        BodyContentHandler handler = new BodyContentHandler(MAX_EXTRACTED_CHARACTERS);
        Metadata metadata = new Metadata();
        metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, safeResourceName(originalName));
        ParseContext context = new ParseContext();
        context.set(OutputLimits.class,
                new OutputLimits(MAX_EXTRACTED_CHARACTERS, false, 100, 10, 1_000_000, 100));

        boolean truncated = false;
        try (TikaInputStream input = TikaInputStream.get(path)) {
            try {
                new AutoDetectParser().parse(input, handler, metadata, context);
            } catch (WriteLimitReachedException limitReached) {
                truncated = true;
            }

            String extracted = normalize(handler.toString());
            if (extracted.length() > MAX_EXTRACTED_CHARACTERS) {
                extracted = extracted.substring(0, MAX_EXTRACTED_CHARACTERS);
                truncated = true;
            }
            if (extracted.isBlank()) {
                return new ExtractionResult("", "EMPTY",
                        "Текст не обнаружен. Возможно, PDF является сканом; для сканов требуется OCR.");
            }
            return new ExtractionResult(extracted, truncated ? "TRUNCATED" : "INDEXED",
                    truncated ? "Индекс ограничен первыми " + MAX_EXTRACTED_CHARACTERS
                            + " символами; оставшаяся часть файла в поиске не участвует." : null);
        } catch (Exception ex) {
            log.warn("Could not extract searchable text from attachment {}", safeResourceName(originalName), ex);
            return new ExtractionResult("", "FAILED",
                    "Не удалось извлечь текст. Файл доступен для скачивания, но его содержимое в поиске не участвует.");
        }
    }

    private static String extensionOf(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String safeResourceName(String name) {
        return name == null || name.isBlank() ? "attachment" : name.replace('\n', ' ').replace('\r', ' ');
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.replace((char) 0, ' ')
                .replaceAll("[\\t\\r ]+", " ")
                .replaceAll(" *\\n *", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    public record ExtractionResult(String text, String status, String note) {}
}
