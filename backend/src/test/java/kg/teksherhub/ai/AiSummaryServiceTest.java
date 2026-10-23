package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.document.DocumentTextExtractionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AiSummaryServiceTest {
    private final DocumentTextExtractionService textExtraction = new DocumentTextExtractionService();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void reportsMissingServerApiKeyWithoutMakingARequest() {
        AiSummaryService service = new AiSummaryService("", "openai/gpt-oss-20b", objectMapper, textExtraction);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.summarize(request("Some document text"), null));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        assertEquals(true, exception.getReason().contains("GROQ_API_KEY"));
    }

    @Test
    void requiresDocumentTextOrAnAttachment() {
        AiSummaryService service = new AiSummaryService("test-key", "openai/gpt-oss-20b", objectMapper, textExtraction);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () ->
                service.summarize(request("  "), null));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals(true, exception.getReason().contains("текст документа"));
    }

    private static AiSummaryService.SummaryRequest request(String content) {
        return new AiSummaryService.SummaryRequest(
                "Инструкция по работе с карточками", "KG", "Инструкция", "Карточки товаров",
                null, null, null, null, null, content, "ru");
    }
}
