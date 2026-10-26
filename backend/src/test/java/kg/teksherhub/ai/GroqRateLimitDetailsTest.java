package kg.teksherhub.ai;

import org.junit.jupiter.api.Test;

import java.net.http.HttpHeaders;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GroqRateLimitDetailsTest {

    @Test
    void explainsTokenPerMinuteLimitAndHonorsRetryAfterHeader() {
        HttpHeaders headers = headers(Map.of(
                "retry-after", List.of("45"),
                "x-ratelimit-limit-tokens", List.of("12000"),
                "x-ratelimit-remaining-tokens", List.of("0"),
                "x-ratelimit-limit-requests", List.of("30"),
                "x-ratelimit-remaining-requests", List.of("29")));
        String body = """
                {"error":{"message":"Rate limit reached for model on tokens per minute (TPM)."}}
                """;

        String message = GroqRateLimitDetails.describe(headers, body);

        assertTrue(message.contains("лимит токенов в минуту (TPM)"));
        assertTrue(message.contains("Остаток токенов: 0 из 12000"));
        assertTrue(message.contains("Остаток запросов: 29 из 30"));
        assertTrue(message.contains("через 45 сек."));
    }

    @Test
    void usesTokenResetDurationWhenRetryAfterIsMissing() {
        HttpHeaders headers = headers(Map.of(
                "x-ratelimit-remaining-tokens", List.of("0"),
                "x-ratelimit-reset-tokens", List.of("1m30s")));

        String message = GroqRateLimitDetails.describe(headers, "");

        assertTrue(message.contains("лимит токенов"));
        assertTrue(message.contains("через 1 мин. 30 сек."));
    }

    @Test
    void identifiesRequestLimitAndUsesRequestReset() {
        HttpHeaders headers = headers(Map.of(
                "x-ratelimit-limit-requests", List.of("60"),
                "x-ratelimit-remaining-requests", List.of("0"),
                "x-ratelimit-reset-requests", List.of("6s")));

        String message = GroqRateLimitDetails.describe(headers, "");

        assertTrue(message.contains("лимит запросов"));
        assertTrue(message.contains("Остаток запросов: 0 из 60"));
        assertTrue(message.contains("через 6 сек."));
    }

    @Test
    void doesNotInventRetryTimingWhenProviderDidNotSupplyIt() {
        String message = GroqRateLimitDetails.describe(headers(Map.of()), "");

        assertTrue(message.contains("не сообщил срок восстановления"));
        assertFalse(message.contains("через 0 сек."));
    }

    private static HttpHeaders headers(Map<String, List<String>> values) {
        return HttpHeaders.of(values, (name, value) -> true);
    }
}
