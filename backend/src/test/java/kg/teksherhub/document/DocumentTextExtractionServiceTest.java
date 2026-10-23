package kg.teksherhub.document;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
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
    void reportsEmptyImageFileWithoutClaimingItWasIndexed() throws Exception {
        Path file = tempDir.resolve("empty.png");
        Files.write(file, new byte[0]);

        var result = service.extract(file, "empty.png");

        assertEquals("EMPTY", result.status());
        assertTrue(result.text().isEmpty());
        assertTrue(result.note().contains("Файл пустой"));
    }

    @Test
    void reportsEmptyTextFilesWithoutClaimingTheyWereIndexed() throws Exception {
        Path file = tempDir.resolve("empty.txt");
        Files.writeString(file, "");

        var result = service.extract(file, "empty.txt");

        assertEquals("EMPTY", result.status());
        assertTrue(result.text().isEmpty());
    }

    @Test
    void recognizesTextInAnImageWhenTesseractLanguagesAreInstalled() throws Exception {
        Assumptions.assumeTrue(hasOcrLanguages(), "Tesseract rus+kir+eng is not installed in this environment");

        Path imagePath = tempDir.resolve("scan.png");
        BufferedImage image = new BufferedImage(1800, 320, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.setColor(Color.BLACK);
            graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 112));
            graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                    RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            graphics.drawString("OCRTEST 987654", 70, 220);
        } finally {
            graphics.dispose();
        }
        assertTrue(ImageIO.write(image, "png", imagePath.toFile()));

        var result = service.extract(imagePath, "scan.png");

        assertEquals("OCR_INDEXED", result.status(), result.note());
        assertTrue(result.text().contains("987654"), "OCR should capture the numeric test marker: " + result.text());
        assertTrue(result.note().contains("Tesseract OCR"));
    }

    private boolean hasOcrLanguages() {
        try {
            Process process = new ProcessBuilder("tesseract", "--list-langs").redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.waitFor() != 0) return false;
            return output.contains("eng") && output.contains("rus") && output.contains("kir");
        } catch (IOException ex) {
            return false;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
