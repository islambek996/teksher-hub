package kg.teksherhub.document;

import org.apache.tika.config.OutputLimits;
import org.apache.tika.exception.WriteLimitReachedException;
import org.apache.tika.io.TikaInputStream;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

/**
 * Extracts a bounded searchable text index. Scanned PDFs and images are retried
 * with Tesseract OCR; OCR output is explicitly identified for human verification.
 */
@Service
public class DocumentTextExtractionService {
    private static final Logger log = LoggerFactory.getLogger(DocumentTextExtractionService.class);
    private static final int MAX_EXTRACTED_CHARACTERS = 100_000;
    private static final long MAX_OCR_IMAGE_BYTES = 10L * 1024 * 1024;
    private static final long OCR_TIMEOUT_MILLIS = 15_000;
    private static final Set<String> SUPPORTED_EXTENSIONS =
            Set.of("pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "png", "jpg", "jpeg");
    private static final Set<String> OCR_EXTENSIONS = Set.of("pdf", "png", "jpg", "jpeg");

    public ExtractionResult extract(Path path, String originalName) {
        String extension = extensionOf(originalName);
        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            return new ExtractionResult("", "NOT_SUPPORTED",
                    "Автоматическое извлечение текста из этого формата не поддерживается.");
        }

        try {
            if (Files.size(path) == 0) {
                return new ExtractionResult("", "EMPTY", "Файл пустой – извлекать текст нечего.");
            }
        } catch (IOException ex) {
            log.warn("Could not inspect attachment size for {}", safeResourceName(originalName), ex);
            return new ExtractionResult("", "FAILED", "Не удалось прочитать файл для извлечения текста.");
        }

        try {
            ParseOutput result = parse(path, originalName, false);
            String extracted = result.text();
            if (!extracted.isBlank()) {
                return new ExtractionResult(extracted, result.truncated() ? "TRUNCATED" : "INDEXED",
                        result.truncated() ? "Индекс ограничен первыми " + MAX_EXTRACTED_CHARACTERS
                                + " символами; оставшаяся часть файла в поиске не участвует." : null);
            }

            if (!OCR_EXTENSIONS.contains(extension)) {
                return new ExtractionResult("", "EMPTY",
                        "Текст не обнаружен. Возможно, файл содержит только изображения.");
            }

            ParseOutput ocrResult = parse(path, originalName, true);
            if (ocrResult.text().isBlank()) {
                return new ExtractionResult("", "EMPTY",
                        "Текст не обнаружен даже после попытки OCR. Проверьте качество скана и читаемость страниц.");
            }

            String note = "Текст распознан автоматически (Tesseract OCR). Проверьте имена, номера, даты и другие реквизиты по изображению.";
            if (ocrResult.truncated()) {
                note += " Индекс ограничен первыми " + MAX_EXTRACTED_CHARACTERS + " символами.";
            }
            return new ExtractionResult(ocrResult.text(), ocrResult.truncated() ? "TRUNCATED" : "OCR_INDEXED", note);
        } catch (Exception ex) {
            log.warn("Could not extract searchable text from attachment {}", safeResourceName(originalName), ex);
            return new ExtractionResult("", "FAILED",
                    "Не удалось извлечь текст. Файл доступен для скачивания, но его содержимое в поиске не участвует.");
        }
    }

    private ParseOutput parse(Path path, String originalName, boolean enableOcr) throws Exception {
        BodyContentHandler handler = new BodyContentHandler(MAX_EXTRACTED_CHARACTERS);
        Metadata metadata = new Metadata();
        metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, safeResourceName(originalName));
        ParseContext context = new ParseContext();
        context.set(OutputLimits.class,
                new OutputLimits(MAX_EXTRACTED_CHARACTERS, false, 100, 10, 1_000_000, 100));

        // A new config per parse avoids sharing the non-thread-safe Tika OCR configuration.
        TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
        ocrConfig.setLanguage("rus+kir+eng");
        ocrConfig.setTimeoutMillis(OCR_TIMEOUT_MILLIS);
        ocrConfig.setMaxFileSizeToOcr(MAX_OCR_IMAGE_BYTES);
        ocrConfig.setSkipOcr(!enableOcr);
        context.set(TesseractOCRConfig.class, ocrConfig);

        boolean truncated = false;
        try (TikaInputStream input = TikaInputStream.get(path)) {
            try {
                new AutoDetectParser().parse(input, handler, metadata, context);
            } catch (WriteLimitReachedException limitReached) {
                truncated = true;
            }
        }

        String text = normalize(handler.toString());
        if (text.length() > MAX_EXTRACTED_CHARACTERS) {
            text = text.substring(0, MAX_EXTRACTED_CHARACTERS);
            truncated = true;
        }
        return new ParseOutput(text, truncated);
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
                .replaceAll("\\n{3,}", "\n\\n")
                .trim();
    }

    private record ParseOutput(String text, boolean truncated) {}
    public record ExtractionResult(String text, String status, String note) {}
}
