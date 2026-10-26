package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.document.DocumentTextExtractionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.ArgumentMatchers;

import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

    @Test
    void returnsGeneratedDescriptionFromSuccessfulGroqResponse() throws Exception {
        HttpClient client = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = (HttpResponse<String>) mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn("""
                {"output":[{"type":"message","content":[{"type":"output_text","text":"Материал описывает порядок маркировки товаров."}]}]}
                """);
        when(client.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        AiSummaryService service = new AiSummaryService(
                "test-key", "openai/gpt-oss-20b", objectMapper, textExtraction, client);

        AiSummaryService.SummaryResponse result = service.summarize(request("Исходный текст документа"), null);

        assertEquals("Материал описывает порядок маркировки товаров.", result.description());
    }

    @Test
    void includesGroqRetryTimingWhenSummaryGenerationIsRateLimited() throws Exception {
        HttpClient client = mock(HttpClient.class);
        @SuppressWarnings("unchecked")
        HttpResponse<String> response = (HttpResponse<String>) mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(429);
        when(response.body()).thenReturn("""
                {"error":{"message":"Rate limit reached for model on tokens per minute (TPM)."}}
                """);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of(
                "retry-after", List.of("40"),
                "x-ratelimit-limit-tokens", List.of("12000"),
                "x-ratelimit-remaining-tokens", List.of("0")), (name, value) -> true));
        when(client.send(any(HttpRequest.class), ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        AiSummaryService service = new AiSummaryService(
                "test-key", "openai/gpt-oss-20b", objectMapper, textExtraction, client);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.summarize(request("Исходный текст документа"), null));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        assertTrue(exception.getReason().contains("TPM"));
        assertTrue(exception.getReason().contains("через 40 сек."));
        assertTrue(exception.getReason().contains("Остаток токенов: 0 из 12000"));
    }

    private static AiSummaryService.SummaryRequest request(String content) {
        return new AiSummaryService.SummaryRequest(
                "Инструкция по работе с карточками", "KG", "Инструкция", "Карточки товаров",
                null, null, null, null, null, content, "ru");
    }
}
