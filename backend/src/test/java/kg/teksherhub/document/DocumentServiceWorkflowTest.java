package kg.teksherhub.document;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DocumentServiceWorkflowTest {
    private DocumentRepository documents;
    private DocumentVersionRepository versions;
    private DocumentFileRepository files;
    private FileStorageService storage;
    private DocumentLinkRepository links;
    private JdbcTemplate jdbc;
    private DocumentService service;

    @BeforeEach
    void setUp() {
        documents = mock(DocumentRepository.class);
        versions = mock(DocumentVersionRepository.class);
        files = mock(DocumentFileRepository.class);
        storage = mock(FileStorageService.class);
        links = mock(DocumentLinkRepository.class);
        jdbc = mock(JdbcTemplate.class);
        service = new DocumentService(documents, versions, files, storage, links, jdbc);
        when(files.countByDocumentId(any(UUID.class))).thenReturn(0L);
        when(links.findRelatedIdsByDocumentId(any(UUID.class))).thenReturn(List.of());
        when(documents.save(any(DocumentRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createCannotPublishDocumentBySupplyingActiveStatus() {
        DocumentRequest request = request("ACTIVE");
        DocumentResponse created = service.create(request, "editor");

        assertEquals("UNDER_REVIEW", created.status());
        assertNull(created.officialSourceCheckedAt());
    }

    @Test
    void updateCannotChangeDraftToActive() {
        DocumentRecord existing = existingDocument(DocumentStatus.DRAFT);
        when(documents.findById(existing.getId())).thenReturn(Optional.of(existing));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.update(existing.getId(), request("ACTIVE"), "editor"));

        assertTrue(error.getMessage().contains("только через действие проверки актуальности"));
        verify(documents, never()).save(any(DocumentRecord.class));
        verify(versions, never()).save(any(DocumentVersion.class));
    }

    @Test
    void updateOfActiveDocumentRequiresReviewAgainWhenContentChanges() {
        DocumentRecord existing = existingDocument(DocumentStatus.ACTIVE);
        when(documents.findById(existing.getId())).thenReturn(Optional.of(existing));

        DocumentResponse updated = service.update(existing.getId(), request("ACTIVE"), "editor");

        assertEquals("UNDER_REVIEW", updated.status());
        assertNull(updated.officialSourceCheckedAt());
        assertTrue(updated.sourceCheckNote().contains("Требуется повторная проверка"));
    }

    @Test
    void updateWithoutReviewRelevantChangesMayKeepActiveStatus() {
        DocumentRecord existing = existingDocument(DocumentStatus.ACTIVE);
        when(documents.findById(existing.getId())).thenReturn(Optional.of(existing));
        DocumentRequest unchanged = new DocumentRequest("Существующая карточка", "KG", "Нормативный акт",
                "Проверка", null, null, List.of(), null, null, null, null,
                "https://minjust.gov.kg/", "Описание", "Текст", "ACTIVE", "Не менялось");

        DocumentResponse updated = service.update(existing.getId(), unchanged, "editor");

        assertEquals("ACTIVE", updated.status());
        assertNotNull(updated.officialSourceCheckedAt());
    }

    private static DocumentRequest request(String status) {
        return new DocumentRequest("Тестовый документ", "KG", "Нормативный акт", "Проверка",
                null, null, List.of(), "CI-STATUS", null, null, null, "https://minjust.gov.kg/",
                "Описание материала", "Текст", status, "Проверка рабочего процесса");
    }

    private static DocumentRecord existingDocument(DocumentStatus status) {
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setTitle("Существующая карточка");
        document.setJurisdiction("KG");
        document.setKind("Нормативный акт");
        document.setArea("Проверка");
        document.setSourceUrl("https://minjust.gov.kg/");
        document.setDescription("Описание");
        document.setContent("Текст");
        document.setStatus(status);
        if (status == DocumentStatus.ACTIVE) document.setOfficialSourceCheckedAt(java.time.Instant.now());
        document.setCreatedBy("editor");
        document.setUpdatedBy("editor");
        document.setCreatedAt(java.time.Instant.now());
        document.setUpdatedAt(java.time.Instant.now());
        document.setVersionNumber(1);
        return document;
    }
}
