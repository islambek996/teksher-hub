package kg.teksherhub.document;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
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
    void extractsSearchableTextFromWordDocument() throws Exception {
        Path file = tempDir.resolve("instruction.docx");
        try (XWPFDocument document = new XWPFDocument();
             OutputStream output = Files.newOutputStream(file)) {
            document.createParagraph().createRun().setText("DOCX-MARKER-4821");
            document.write(output);
        }

        var result = service.extract(file, "instruction.docx");

        assertEquals("INDEXED", result.status(), result.note());
        assertTrue(result.text().contains("DOCX-MARKER-4821"), result.text());
    }

    @Test
    void extractsSearchableTextFromExcelWorkbook() throws Exception {
        Path file = tempDir.resolve("catalog.xlsx");
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             OutputStream output = Files.newOutputStream(file)) {
            workbook.createSheet("Instructions").createRow(0).createCell(0).setCellValue("XLSX-MARKER-5739");
            workbook.write(output);
        }

        var result = service.extract(file, "catalog.xlsx");

        assertEquals("INDEXED", result.status(), result.note());
        assertTrue(result.text().contains("XLSX-MARKER-5739"), result.text());
    }

    @Test
    void extractsSearchableTextFromPdfDocument() throws Exception {
        Path file = tempDir.resolve("regulation.pdf");
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.beginText();
                stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                stream.newLineAtOffset(50, 700);
                stream.showText("PDF-MARKER-2468");
                stream.endText();
            }
            document.save(file.toFile());
        }

        var result = service.extract(file, "regulation.pdf");

        assertEquals("INDEXED", result.status(), result.note());
        assertTrue(result.text().contains("PDF-MARKER-2468"), result.text());
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
