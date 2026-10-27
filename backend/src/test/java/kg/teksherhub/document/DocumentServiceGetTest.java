package kg.teksherhub.document;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DocumentServiceGetTest {
    @Test
    void missingDocumentUsesNotFoundStatus() {
        DocumentRepository documents = mock(DocumentRepository.class);
        UUID missingId = UUID.randomUUID();
        when(documents.findById(missingId)).thenReturn(Optional.empty());
        DocumentService service = new DocumentService(
                documents,
                mock(DocumentVersionRepository.class),
                mock(DocumentFileRepository.class),
                mock(FileStorageService.class),
                mock(DocumentLinkRepository.class),
                mock(JdbcTemplate.class));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.get(missingId));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        assertEquals("Документ не найден", error.getReason());
        verifyNoInteractions(
                mock(DocumentVersionRepository.class));
    }
}
