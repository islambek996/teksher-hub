package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.document.DocumentRecord;
import kg.teksherhub.document.DocumentStatus;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Deterministic evaluation of the golden questions used to smoke-test
 * query tokenization, jurisdiction routing, official-reference metadata,
 * and safe abstention. Actual generated answers still require a live Groq
 * key and comparison with the current source documents.
 */
class AiAssistantGoldenSetTest {

    private static final Set<String> JURISDICTIONS = Set.of("KG", "RU", "EAEU");

    @Test
    void evaluatesGoldenMarkingQuestionsForRoutingAndSafeFallback() throws IOException {
        try (InputStream input = getClass().getResourceAsStream("/ai-golden-set.json")) {
            assertNotNull(input, "The marking AI golden set must be present in test resources");
            JsonNode cases = new ObjectMapper().readTree(input);
            assertTrue(cases.isArray() && cases.size() >= 10,
                    "Keep a meaningful control set across marking jurisdictions");

            Set<String> ids = new HashSet<>();
            Set<String> coveredJurisdictions = new HashSet<>();

            for (JsonNode item : cases) {
                String id = item.path("id").asText("");
                String question = item.path("question").asText("");
                String expectedJurisdiction = item.path("expectedJurisdiction").asText("");
                String reference = item.path("primaryOfficialReference").asText("");
                String fallback = item.path("whenEvidenceMissing").asText("");

                assertTrue(!id.isBlank(), "Each golden case needs an ID");
                assertTrue(ids.add(id), "Golden case IDs must be unique: " + id);
                assertTrue(!question.isBlank(), "Question is required for " + id);
                assertTrue(JURISDICTIONS.contains(expectedJurisdiction) || "NONE".equals(expectedJurisdiction),
                        "Unexpected jurisdiction in " + id);
                assertTrue(reference.startsWith("https://"),
                        "Reference must use HTTPS for " + id);
                assertTrue(URI.create(reference).getHost() != null,
                        "Reference must contain a host for " + id);
                assertTrue(!item.path("reviewCriterion").asText("").isBlank(),
                        "Each case needs a reviewer criterion: " + id);
                assertTrue(item.path("expectedFacts").isArray() && item.path("expectedFacts").size() > 0,
                        "Each case needs verified facts for answer review: " + id);
                assertTrue(item.path("forbiddenClaims").isArray() && item.path("forbiddenClaims").size() > 0,
                        "Each case needs a hallucination/overgeneralization checklist: " + id);

                String host = URI.create(reference).getHost().toLowerCase(Locale.ROOT);
                Set<String> officialHosts = Set.of("cbd.minjust.gov.kg", "minjust.gov.kg", "gov.kg",
                        "publication.pravo.gov.ru", "eec.eaeunion.org", "docs.eaeunion.org");
                assertTrue(officialHosts.stream().anyMatch(allowed ->
                                host.equals(allowed) || host.endsWith("." + allowed)),
                        "Golden reference must use a recognised official domain, not a third-party summary: " + id);

                if (item.hasNonNull("operationalReference")) {
                    URI operationalReference = URI.create(item.path("operationalReference").asText(""));
                    assertTrue("https".equalsIgnoreCase(operationalReference.getScheme()),
                            "Operator reference must use HTTPS for " + id);
                    assertTrue(Set.of("main.teksher.kg", "label.teksher.kg")
                                    .contains(operationalReference.getHost().toLowerCase(Locale.ROOT)),
                            "Operator reference must point to a recognised TEKSHER host for " + id);
                    assertEquals("UNDER_REVIEW", item.path("operationalReferenceStatus").asText(""),
                            "Unverified operational manuals must remain explicitly marked for review: " + id);
                    assertTrue(!item.path("operationalReferenceNote").asText("").isBlank(),
                            "Operator manual needs an explicit version/currentness caveat: " + id);
                }

                List<String> terms = AiAssistantService.searchTerms(question);
                for (JsonNode requiredTerm : item.path("requiredTerms")) {
                    String term = requiredTerm.asText();
                    assertTrue(terms.contains(term),
                            "Search token '" + term + "' missing for " + id + "; actual: " + terms);
                }

                if ("NONE".equals(expectedJurisdiction)) {
                    for (String jurisdiction : JURISDICTIONS) {
                        DocumentRecord document = document(jurisdiction);
                        assertEquals(0, AiAssistantService.jurisdictionRankingBoost(document, question),
                                "Question must not infer " + jurisdiction + " from product-system wording in " + id);
                    }
                } else {
                    coveredJurisdictions.add(expectedJurisdiction);
                    DocumentRecord matching = document(expectedJurisdiction);
                    assertTrue(AiAssistantService.jurisdictionRankingBoost(matching, question) > 0,
                            "Expected jurisdiction should be boosted for " + id);

                    String mismatchedJurisdiction = "KG".equals(expectedJurisdiction) ? "RU" : "KG";
                    DocumentRecord mismatched = document(mismatchedJurisdiction);
                    assertTrue(AiAssistantService.jurisdictionRankingBoost(mismatched, question) < 0,
                            "Mismatched jurisdiction should be penalized for " + id);
                }

                assertTrue(AiAssistantService.looksInsufficient(fallback),
                        "The no-evidence fallback must be recognized as insufficient for " + id);
            }

            assertEquals(Set.of("KG", "RU", "EAEU"), coveredJurisdictions,
                    "Golden set must cover Kyrgyz Republic, Russia, and EAEU cases");
        }
    }

    private static DocumentRecord document(String jurisdiction) {
        DocumentRecord document = new DocumentRecord();
        document.setStatus(DocumentStatus.ACTIVE);
        document.setJurisdiction(jurisdiction.toUpperCase(Locale.ROOT));
        return document;
    }
}
