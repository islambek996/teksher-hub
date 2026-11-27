package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TnvedCatalogServiceTest {
    @Test
    void loadsAllValidatedCatalogRecordsFromAllCompressedReferenceFiles() {
        TnvedCatalogService catalog = new TnvedCatalogService(new ObjectMapper());

        assertEquals(1_302, catalog.totalEntries());
        assertEquals(869, catalog.countByScope("MZKM"));
        assertEquals(203, catalog.countByScope("INTERNAL"));
        assertEquals(230, catalog.countByScope("EXTERNAL"));
    }

    @Test
    void findsExactTenDigitCodeAndShorterPrefixes() {
        TnvedCatalogService catalog = new TnvedCatalogService(new ObjectMapper());

        TnvedCatalogService.SearchResult exact = catalog.search("9503005500");
        assertEquals("EXACT_10_DIGIT", exact.matchType());
        assertTrue(exact.totalMatches() >= 1);
        assertTrue(exact.matches().stream().allMatch(row -> row.code().equals("9503005500")));

        TnvedCatalogService.SearchResult prefix = catalog.search("9503");
        assertEquals("PREFIX_MATCH", prefix.matchType());
        assertTrue(prefix.totalMatches() > exact.totalMatches());
        assertTrue(prefix.matches().stream().allMatch(row -> row.code().startsWith("9503")));
    }

    @Test
    void findsExternalSweetsCodes() {
        TnvedCatalogService catalog = new TnvedCatalogService(new ObjectMapper());

        TnvedCatalogService.SearchResult result = catalog.search("2008805000");
        assertTrue(result.matches().stream().anyMatch(row ->
                row.scope().equals("EXTERNAL")
                        && row.group().equals("Сладости и кондитерские изделия")
                        && row.name().contains("земляника")));
    }

    @Test
    void rejectsShortAndNonNumericCodes() {
        TnvedCatalogService catalog = new TnvedCatalogService(new ObjectMapper());
        assertThrows(IllegalArgumentException.class, () -> catalog.search("123"));
        assertThrows(IllegalArgumentException.class, () -> catalog.search("ABC9503005500"));
        assertThrows(IllegalArgumentException.class, () -> catalog.search("ABC9503"));
    }
}
