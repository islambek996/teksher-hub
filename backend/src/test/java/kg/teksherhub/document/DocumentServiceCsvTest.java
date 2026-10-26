package kg.teksherhub.document;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DocumentServiceCsvTest {
    @Test
    void prefixesFormulaLikeCellsAndPreservesCsvEscaping() {
        StringBuilder csv = new StringBuilder();

        DocumentService.appendCsvRow(csv, "=1+1", "  =1+1", "+SUM(A1:A2)", "@command", "-1+1", "ordinary", "a\"b");

        assertEquals("\"'=1+1\";\"'  =1+1\";\"'+SUM(A1:A2)\";\"'@command\";\"'-1+1\";\"ordinary\";\"a\"\"b\"\r\n", csv.toString());
    }

    @Test
    void preservesNullAndEmptyValues() {
        StringBuilder csv = new StringBuilder();

        DocumentService.appendCsvRow(csv, null, "", "safe");

        assertEquals("\"\";\"\";\"safe\"\r\n", csv.toString());
    }
}
