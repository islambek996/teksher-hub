package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.document.DocumentRecord;
import kg.teksherhub.document.DocumentStatus;
import kg.teksherhub.document.DocumentRepository;
import kg.teksherhub.process.BusinessProcessGuideRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class McpKnowledgeServiceTest {
    private static McpKnowledgeService service(DocumentRepository documents) {
        ObjectMapper mapper = new ObjectMapper();
        return new McpKnowledgeService(documents,
                mock(BusinessProcessGuideRepository.class),
                mock(JdbcTemplate.class),
                mapper,
                new TnvedCatalogService(mapper));
    }

    @Test
    void searchesNpaByJurisdictionNumberAndDate() {
        DocumentRepository documents = mock(DocumentRepository.class);
        DocumentRecord matching = document("Постановление КР № 470", "KG", "Нормативный акт",
                DocumentStatus.ACTIVE, "470", LocalDate.of(2019, 9, 12), "Маркировка товаров");
        DocumentRecord wrongCountry = document("Постановление РФ № 470", "RU", "Нормативный акт",
                DocumentStatus.ACTIVE, "470", LocalDate.of(2019, 9, 12), "Маркировка товаров");
        when(documents.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(wrongCountry, matching));

        McpKnowledgeService.ToolResult result = service(documents).searchNpa(
                "маркировка", "KG", "470", "2019-09-12", "ADMIN");

        assertEquals(1, result.sources().size());
        assertEquals(matching.getId().toString(), result.sources().getFirst().id());
        assertTrue(result.summary().contains("1"));
    }

    @Test
    void readerDoesNotReceiveNonPublicOperatorCardsButCanUseSharedCodeCatalog() {
        DocumentRepository documents = mock(DocumentRepository.class);
        DocumentRecord underReview = document("Справочный перечень 9503005500", "KG", "Справочная информация",
                DocumentStatus.UNDER_REVIEW, null, null, "| 9503005500 | Игрушки |");
        when(documents.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(underReview));

        McpKnowledgeService.ToolResult result = service(documents).checkTnvedCode("9503005500", "READER");
        Map<?, ?> data = (Map<?, ?>) result.data();

        assertTrue(result.sources().stream().noneMatch(source -> "DOCUMENT".equals(source.sourceType())));
        assertTrue(result.sources().stream().anyMatch(source -> "TNVED_CATALOG".equals(source.sourceType())));
        assertTrue(((List<?>) data.get("operatorReferenceMatches")).isEmpty());
        assertEquals("NOT_DETERMINED", data.get("legalConclusion"));
    }

    @Test
    void exactTenDigitTnvedCodeIsDistinguishedFromPrefixMatch() {
        assertEquals(List.of("| 9503005500 | Игрушки |"),
                McpKnowledgeService.matchingCodeLines("| 9503005500 | Игрушки |\n| 9503009909 | Другой товар |", "9503005500"));
        assertEquals(List.of("| 9503005500 | Игрушки |"),
                McpKnowledgeService.matchingCodeLines("| 9503005500 | Игрушки |", "9503"));
        assertTrue(McpKnowledgeService.matchingCodeLines("| 9503009909 | Другой товар |", "9503005500").isEmpty());
    }

    @Test
    void searchesWholeTnvedCatalogAndDistinguishesExactFromPrefix() {
        DocumentRepository documents = mock(DocumentRepository.class);
        when(documents.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of());

        Map<?, ?> exactData = (Map<?, ?>) service(documents).checkTnvedCode("9503005500", "READER").data();
        assertEquals("EXACT_10_DIGIT", exactData.get("matchType"));
        assertTrue(((List<?>) exactData.get("catalogEntries")).size() >= 1);

        Map<?, ?> prefixData = (Map<?, ?>) service(documents).checkTnvedCode("9503", "READER").data();
        assertEquals("PREFIX_MATCH", prefixData.get("matchType"));
        assertTrue(((Number) prefixData.get("catalogTotalMatches")).intValue() > 1);
    }

    @Test
    void editorCanSeeUnderReviewOperatorReferenceButItIsNotATestedLegalConclusion() {
        DocumentRepository documents = mock(DocumentRepository.class);
        DocumentRecord reference = document("ТН ВЭД из новости «Текшер»: детские игрушки",
                "KG", "Справочная информация", DocumentStatus.UNDER_REVIEW, null, null,
                "| 9503005500 | Инструменты и устройства музыкальные игрушечные |");
        when(documents.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(reference));

        McpKnowledgeService.ToolResult result = service(documents).checkTnvedCode("9503005500", "EDITOR");
        Map<?, ?> data = (Map<?, ?>) result.data();

        assertTrue(result.sources().stream().anyMatch(source ->
                "DOCUMENT".equals(source.sourceType()) && "UNDER_REVIEW".equals(source.status())));
        assertFalse(((List<?>) data.get("operatorReferenceMatches")).isEmpty());
        assertEquals("NOT_DETERMINED", data.get("legalConclusion"));
        assertTrue(result.summary().contains("обязательность"));
    }

    @Test
    void rejectsInvalidJurisdictionsAndDates() {
        McpKnowledgeService service = service(mock(DocumentRepository.class));
        assertThrows(IllegalArgumentException.class,
                () -> service.searchNpa("маркировка", "US", null, null, "ADMIN"));
        assertThrows(IllegalArgumentException.class,
                () -> service.searchNpa("маркировка", "KG", null, "12.09.2019", "ADMIN"));
    }

    private static DocumentRecord document(String title, String jurisdiction, String kind,
                                           DocumentStatus status, String number, LocalDate date, String content) {
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setTitle(title);
        document.setJurisdiction(jurisdiction);
        document.setKind(kind);
        document.setArea("Маркировка");
        document.setDocumentNumber(number);
        document.setDocumentDate(date);
        document.setDescription("Описание");
        document.setContent(content);
        document.setStatus(status);
        document.setSourceUrl("https://official.example/");
        document.setOfficialSourceCheckedAt(Instant.parse("2026-01-01T00:00:00Z"));
        document.setCreatedBy("editor");
        document.setUpdatedBy("editor");
        document.setCreatedAt(Instant.now());
        document.setUpdatedAt(Instant.now());
        document.setVersionNumber(1);
        return document;
    }
}
