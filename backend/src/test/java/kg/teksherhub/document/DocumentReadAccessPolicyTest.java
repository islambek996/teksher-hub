package kg.teksherhub.document;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DocumentReadAccessPolicyTest {
    @Test
    void readerCanReadOnlyActiveNonInternalDocuments() {
        assertTrue(DocumentReadAccessPolicy.canRead("READER", "ACTIVE", "Нормативный акт"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "DRAFT", "Нормативный акт"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "UNDER_REVIEW", "Нормативный акт"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "ARCHIVED", "Инструкция"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "ACTIVE", "Внутренний документ"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "ACTIVE", "Внутренний регламент"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "ACTIVE", "Internal document"));
        assertFalse(DocumentReadAccessPolicy.canRead("READER", "ACTIVE", "INTERNAL"));
    }

    @Test
    void editorsAndAdminsCanReadAllDocumentStatuses() {
        for (String role : new String[]{"ADMIN", "EDITOR"}) {
            assertTrue(DocumentReadAccessPolicy.canRead(role, "DRAFT", "Внутренний документ"));
            assertTrue(DocumentReadAccessPolicy.canRead(role, "UNDER_REVIEW", "Нормативный акт"));
            assertTrue(DocumentReadAccessPolicy.canRead(role, "ARCHIVED", "Инструкция"));
        }
    }

    @Test
    void unknownRolesDoNotGetReaderAccessByDefault() {
        assertFalse(DocumentReadAccessPolicy.canRead("UNKNOWN", "ACTIVE", "Нормативный акт"));
    }
}
