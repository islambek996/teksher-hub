package kg.teksherhub.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class McpAiToolCallingServiceTest {
    @Test
    void invokesToolSelectionForRegulatoryAndSpecificReferenceQuestions() {
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Найди постановление КР № 470"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Проверь код ТН ВЭД 9503005500"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Проверь код 9503005500"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Какие бизнес-процессы связаны с маркировкой?"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Как зарегистрировать участника и создать карточку товара?"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Покажи события изменений официальных источников"));
    }

    @Test
    void invokesProductGroupLookupForKnownMarkingCategories() {
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Какие требования по детским игрушкам?"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Проверить товарную группу бакалея"));
        assertTrue(McpAiToolCallingService.isRelevantQuestion("Какие правила по косметике?"));
    }

    @Test
    void avoidsExtraToolSelectionForGreetingsAndGenericExplanations() {
        assertFalse(McpAiToolCallingService.isRelevantQuestion("Привет, как дела?"));
        assertFalse(McpAiToolCallingService.isRelevantQuestion("Объясни, что такое DataMatrix в общем виде"));
    }
}
