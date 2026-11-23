package kg.teksherhub.document;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentServiceSearchTest {
    private DocumentRepository documents;
    private DocumentFileRepository files;
    private DocumentLinkRepository links;
    private JdbcTemplate jdbc;
    private DocumentService service;

    @BeforeEach
    void setUp() {
        documents = mock(DocumentRepository.class);
        files = mock(DocumentFileRepository.class);
        links = mock(DocumentLinkRepository.class);
        jdbc = mock(JdbcTemplate.class);
        service = new DocumentService(
                documents,
                mock(DocumentVersionRepository.class),
                files,
                mock(FileStorageService.class),
                links,
                jdbc
        );
        when(files.countByDocumentId(any(UUID.class))).thenReturn(0L);
        when(links.findRelatedIdsByDocumentId(any(UUID.class))).thenReturn(List.of());
    }

    @Test
    void returnsDatabaseRankedMatchesInSearchOrder() {
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        DocumentRecord first = document(firstId, "Первый результат");
        DocumentRecord second = document(secondId, "Второй результат");

        doReturn(List.of(firstId, secondId)).when(jdbc)
                .queryForList(anyString(), eq(UUID.class), any(Object[].class));
        when(files.findDocumentIdsWithExtractedTextContaining("маркировка")).thenReturn(List.of());
        when(documents.findAllById(any(Iterable.class))).thenReturn(List.of(second, first));

        List<DocumentResponse> results = service.list("маркировка", "KG", null, null);

        assertEquals(List.of(firstId, secondId), results.stream().map(DocumentResponse::id).toList());
        org.mockito.ArgumentCaptor<String> sql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(), eq(UUID.class), any(Object[].class));
        assertTrue(sql.getValue().contains("d.search_vector @@ search_query.ts_query"));
        assertTrue(sql.getValue().contains("websearch_to_tsquery('russian'"));
    }

    @Test
    void keepsAttachmentOnlyMatchesInSearchResults() {
        UUID id = UUID.randomUUID();
        DocumentRecord document = document(id, "Карточка без совпадения в тексте");

        doReturn(List.of()).when(jdbc)
                .queryForList(anyString(), eq(UUID.class), any(Object[].class));
        when(files.findDocumentIdsWithExtractedTextContaining("уникальныйфрагмент")).thenReturn(List.of(id));
        when(documents.findAllById(any(Iterable.class))).thenReturn(List.of(document));

        List<DocumentResponse> results = service.list("уникальныйфрагмент", null, null, null);

        assertEquals(1, results.size());
        assertTrue(results.getFirst().matchedInAttachment());
        assertEquals(id, results.getFirst().id());
    }

    private static DocumentRecord document(UUID id, String title) {
        DocumentRecord document = new DocumentRecord();
        document.setId(id);
        document.setTitle(title);
        document.setJurisdiction("KG");
        document.setKind("Нормативный акт");
        document.setArea("Маркировка товаров");
        document.setDescription("Описание");
        document.setContent("");
        document.setStatus(DocumentStatus.ACTIVE);
        document.setCreatedBy("editor");
        document.setUpdatedBy("editor");
        document.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        document.setUpdatedAt(Instant.parse("2026-01-02T00:00:00Z"));
        document.setVersionNumber(1);
        return document;
    }
}
