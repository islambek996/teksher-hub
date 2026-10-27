package kg.teksherhub.process;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BusinessProcessStepTransitionTest {
    @Test
    void addsHttpsToDomainWithoutProtocol() {
        assertEquals("https://teksher.kg", BusinessProcessGuideService.normalizeSourceUrl("teksher.kg"));
        assertEquals("https://www.example.org/docs", BusinessProcessGuideService.normalizeSourceUrl(" www.example.org/docs "));
    }

    @Test
    void preservesExplicitHttpAndHttpsProtocols() {
        assertEquals("http://example.org", BusinessProcessGuideService.normalizeSourceUrl("http://example.org"));
        assertEquals("https://example.org", BusinessProcessGuideService.normalizeSourceUrl("https://example.org"));
    }

    @Test
    void validatesBareDomainAsSecureHttpsSource() {
        assertDoesNotThrow(() -> BusinessProcessGuideService.validateSources(List.of(
                new BusinessProcessSource("Сайт", "teksher.kg")
        )));
    }

    @Test
    void acceptsValidHttpAndHttpsSources() {
        assertDoesNotThrow(() -> BusinessProcessGuideService.validateSources(List.of(
                new BusinessProcessSource("Документация", "https://example.org/docs"),
                new BusinessProcessSource("Сайт", "http://example.org")
        )));
    }

    @Test
    void rejectsSourceWithMissingLabelOrUrl() {
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource(" ", "https://example.org")
                )));
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", " ")
                )));
    }

    @Test
    void rejectsMalformedOrUnsupportedSourceUrls() {
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", "javascript:alert(1)")
                )));
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", "https://")
                )));
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", "https:// not a domain")
                )));
    }

    @Test
    void rejectsUrlsContainingUserInfo() {
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", "https://example.org@evil.example/path")
                )));
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(List.of(
                        new BusinessProcessSource("Документация", "https://user:password@example.org/path")
                )));
    }

    @Test
    void rejectsNullSourceEntries() {
        assertThrows(IllegalArgumentException.class, () ->
                BusinessProcessGuideService.validateSources(java.util.Arrays.asList((BusinessProcessSource) null)));
    }

    @Test
    void acceptsValidBranchTargetsAndDecision() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", "Продолжить", "Исправить", 1, 2),
                new BusinessProcessStep("Продолжить", "Следующий этап", null, null,
                        null, null, null, null, null),
                new BusinessProcessStep("Исправить", "Устранить ошибки", null, null,
                        null, null, null, null, null)
        );

        assertDoesNotThrow(() -> BusinessProcessGuideService.validateStepTransitions(steps));
    }

    @Test
    void rejectsTargetOutsideStepList() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", null, null, 4, null)
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));

        assertTrue(error.getMessage().contains("существующий шаг"));
    }

    @Test
    void rejectsNegativeTarget() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", null, null, null, -1)
        );

        assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));
    }

    @Test
    void rejectsSelfTransition() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", null, null, 0, null)
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));

        assertTrue(error.getMessage().contains("не может вести на тот же шаг"));
    }

    @Test
    void rejectsBranchWithoutDecisionQuestion() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        " ", null, null, 1, null),
                new BusinessProcessStep("Следующий шаг", "Действие", null, null,
                        null, null, null, null, null)
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));

        assertTrue(error.getMessage().contains("контрольный вопрос"));
    }
}
