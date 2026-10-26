package kg.teksherhub.document;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileStorageServiceTest {
    @TempDir
    Path tempDir;

    @Test
    void storesAllowedFileUnderGeneratedNameAndPreservesContent() throws Exception {
        FileStorageService service = new FileStorageService(tempDir.toString());
        byte[] contents = "Инструкция по маркировке".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile upload = new MockMultipartFile(
                "file", "instruction.txt", "text/plain", contents);

        FileStorageService.StoredFile stored = service.store(upload);

        assertEquals("instruction.txt", stored.originalName());
        assertTrue(stored.storedName().matches("[0-9a-fA-F-]{36}\\.txt"));
        assertTrue(Files.isRegularFile(stored.path()));
        assertEquals("Инструкция по маркировке", Files.readString(stored.path()));
        assertEquals(contents.length, stored.sizeBytes());
    }

    @Test
    void rejectsPathTraversalAndUnsupportedExtensions() {
        FileStorageService service = new FileStorageService(tempDir.toString());
        MockMultipartFile traversal = new MockMultipartFile(
                "file", "../secret.txt", "text/plain", "not allowed".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile executable = new MockMultipartFile(
                "file", "payload.exe", "application/octet-stream", new byte[]{1, 2, 3});

        assertThrows(IllegalArgumentException.class, () -> service.store(traversal));
        assertThrows(IllegalArgumentException.class, () -> service.store(executable));
        assertThrows(IllegalArgumentException.class, () -> service.resolve("../secret.txt"));
        assertFalse(Files.exists(tempDir.resolve("secret.txt")));
    }

    @Test
    void rejectsEmptyUpload() {
        FileStorageService service = new FileStorageService(tempDir.toString());
        MockMultipartFile upload = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]);

        assertThrows(IllegalArgumentException.class, () -> service.store(upload));
    }
}
