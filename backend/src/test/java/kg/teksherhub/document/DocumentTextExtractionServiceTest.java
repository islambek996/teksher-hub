package kg.teksherhub.document;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentTextExtractionServiceTest {
    @TempDir
    Path tempDir;

    private final DocumentTextExtractionService service = new DocumentTextExtractionService();

    @Test
    void extractsSearchableTextFromPlainTextFile() throws Exception {
        Path file = tempDir.resolve("instruction.txt");
        Files.writeString(file, "Заказать код маркировки\nПроверить карточку товара");

        var result = service.extract(file, "instruction.txt");

        assertEquals("INDEXED", result.status());
        assertTrue(result.text().contains("Заказать код маркировки"));
        assertTrue(result.text().contains("Проверить карточку товара"));
    }

    @Test
    void reportsImagesAsNotSupportedWithoutAttemptingOcr() {
        var result = service.extract(tempDir.resolve("scan.png"), "scan.png");

        assertEquals("NOT_SUPPORTED", result.status());
        assertTrue(result.note().contains("OCR"));
        assertTrue(result.text().isEmpty());
    }

    @Test
    void reportsEmptyTextFilesWithoutClaimingTheyWereIndexed() throws Exception {
        Path file = tempDir.resolve("empty.txt");
        Files.writeString(file, "");

        var result = service.extract(file, "empty.txt");

        assertEquals("EMPTY", result.status());
        assertTrue(result.text().isEmpty());
    }
}
