package kg.teksherhub.ai;

import kg.teksherhub.document.DocumentRecord;
import kg.teksherhub.document.DocumentStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiAssistantRetrievalTest {

    @Test
    void keepsShortMarkingTermsInSearchQueries() {
        List<String> terms = AiAssistantService.searchTerms("Ошибка заказа КМ для РФ");

        assertTrue(terms.contains("км"), "КМ is a critical marking-system abbreviation");
        assertTrue(terms.contains("рф"), "RF jurisdiction abbreviations should be searchable");
    }

    @Test
    void ranksActiveDocumentsAboveDraftAndArchivedDocuments() {
        LocalDate today = LocalDate.of(2026, 10, 26);
        DocumentRecord active = document(DocumentStatus.ACTIVE);
        DocumentRecord draft = document(DocumentStatus.DRAFT);
        DocumentRecord archived = document(DocumentStatus.ARCHIVED);

        assertTrue(AiAssistantService.statusRankingBoost(active, today)
                > AiAssistantService.statusRankingBoost(draft, today));
        assertTrue(AiAssistantService.statusRankingBoost(draft, today)
                > AiAssistantService.statusRankingBoost(archived, today));
    }

    @Test
    void penalizesDocumentsOutsideTheirEffectivePeriod() {
        LocalDate today = LocalDate.of(2026, 10, 26);
        DocumentRecord inForce = document(DocumentStatus.ACTIVE);
        DocumentRecord expiredByDate = document(DocumentStatus.ACTIVE);
        expiredByDate.setEffectiveUntil(today.minusDays(1));
        DocumentRecord futureByDate = document(DocumentStatus.ACTIVE);
        futureByDate.setEffectiveFrom(today.plusDays(1));

        assertTrue(AiAssistantService.statusRankingBoost(inForce, today)
                > AiAssistantService.statusRankingBoost(expiredByDate, today));
        assertTrue(AiAssistantService.statusRankingBoost(inForce, today)
                > AiAssistantService.statusRankingBoost(futureByDate, today));
    }


    @Test
    void biasesDocumentsOnlyWhenQuestionNamesAJurisdiction() {
        DocumentRecord kyrgyz = document(DocumentStatus.ACTIVE);
        kyrgyz.setJurisdiction("KG");
        DocumentRecord russian = document(DocumentStatus.ACTIVE);
        russian.setJurisdiction("RU");

        assertTrue(AiAssistantService.jurisdictionRankingBoost(kyrgyz, "Порядок ГАИС МТ в КР") > 0);
        assertTrue(AiAssistantService.jurisdictionRankingBoost(russian, "Правила Честного ЗНАКА РФ") > 0);
        assertEquals(0, AiAssistantService.jurisdictionRankingBoost(kyrgyz, "МЗКМ: заказ кодов"));
    }

    @Test
    void assistantReturnsPersonalizedCreatorReply() {
        String answer = AiAssistantService.assistantIdentityReply("кто тебя создал");

        assertTrue(answer != null);
        assertTrue(answer.contains("Жакыпбеков Исламбек Эрланович"));
        assertTrue(answer.contains("самый красивый сотрудник оператора маркировки"));
        assertTrue(answer.contains("развивает TEKSHER HUB"));
    }

    @Test
    void missingEvidencePhrasesAreFlaggedAsInsufficient() {
        assertTrue(AiAssistantService.looksInsufficient(
                "В доступных материалах это не подтверждено."));
        assertTrue(AiAssistantService.looksInsufficient(
                "В материалах не указано, действует ли это требование."));
        assertTrue(AiAssistantService.looksInsufficient(
                "Маалымат жетишсиз."));
        assertFalse(AiAssistantService.looksInsufficient(
                "Порядок подтверждён пунктом 4 найденной инструкции [1]."));
    }

    @Test
    void acceptsOnlyCitationsToAvailableSources() {
        AiAssistantService.CitationCheck valid =
                AiAssistantService.validateCitations("Порядок указан в инструкции [1].", Set.of(1, 2));
        assertEquals("Порядок указан в инструкции [1].", valid.answer());
        assertFalse(valid.invalidFound());
        assertFalse(valid.missingFound());

        AiAssistantService.CitationCheck invalid =
                AiAssistantService.validateCitations("Порядок указан [7].", Set.of(1, 2));
        assertEquals("Порядок указан.", invalid.answer());
        assertTrue(invalid.invalidFound());
        assertTrue(invalid.missingFound());

        AiAssistantService.CitationCheck missing =
                AiAssistantService.validateCitations("Порядок указан в инструкции.", Set.of(1, 2));
        assertTrue(missing.missingFound());
        assertFalse(missing.invalidFound());
    }

    private static DocumentRecord document(DocumentStatus status) {
        DocumentRecord document = new DocumentRecord();
        document.setStatus(status);
        return document;
    }
}
