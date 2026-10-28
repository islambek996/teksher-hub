package kg.teksherhub.security;

import kg.teksherhub.document.AttachmentIndexAdminController;
import kg.teksherhub.document.DocumentController;
import kg.teksherhub.document.DocumentFileController;
import kg.teksherhub.document.StorageBackupController;
import kg.teksherhub.user.UserAdminController;
import kg.teksherhub.web.AuditLogController;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SecurityRoleAuthorizationTest {

    @Test
    void auditAndUserAdministrationAreAdminOnly() {
        assertClassGuard(AuditLogController.class, "hasRole('ADMIN')");
        assertClassGuard(UserAdminController.class, "hasRole('ADMIN')");
        assertMethodGuard(StorageBackupController.class, "exportUploads", "hasRole('ADMIN')");
    }

    @Test
    void attachmentAdministrationHasExplicitRoleGuards() {
        assertMethodGuard(AttachmentIndexAdminController.class, "reindexUnindexed",
                "hasRole('ADMIN')");
        assertMethodGuard(DocumentFileController.class, "upload",
                "hasAnyRole('ADMIN','EDITOR')");
        assertMethodGuard(DocumentFileController.class, "reindex",
                "hasAnyRole('ADMIN','EDITOR')");
        assertMethodGuard(DocumentFileController.class, "delete",
                "hasAnyRole('ADMIN','EDITOR')");
    }

    @Test
    void documentMutationsAndExportRequireEditorOrAdmin() {
        Map<String, String> expected = Map.of(
                "exportCsv", "hasAnyRole('ADMIN','EDITOR')",
                "create", "hasAnyRole('ADMIN','EDITOR')",
                "importDocuments", "hasAnyRole('ADMIN','EDITOR')",
                "update", "hasAnyRole('ADMIN','EDITOR')",
                "review", "hasAnyRole('ADMIN','EDITOR')"
        );
        expected.forEach((method, expression) ->
                assertMethodGuard(DocumentController.class, method, expression));
    }

    private static void assertClassGuard(Class<?> type, String expected) {
        PreAuthorize annotation = type.getAnnotation(PreAuthorize.class);
        assertNotNull(annotation, type.getSimpleName() + " must declare a class-level @PreAuthorize");
        assertEquals(expected, annotation.value(), type.getSimpleName() + " role guard changed");
    }

    private static void assertMethodGuard(Class<?> type, String methodName, String expected) {
        Method method = java.util.Arrays.stream(type.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing method " + type.getSimpleName() + "." + methodName));
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
        assertNotNull(annotation, type.getSimpleName() + "." + methodName
                + " must declare @PreAuthorize");
        assertEquals(expected, annotation.value(), type.getSimpleName() + "." + methodName + " role guard changed");
    }
}
