package kg.teksherhub.document;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;

public final class DocumentReadAccessPolicy {
    private static final Set<String> PRIVILEGED_ROLES = Set.of("ADMIN", "EDITOR");

    private DocumentReadAccessPolicy() {}

    public static boolean canRead(String role, String status, String kind) {
        String normalizedRole = role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
        if (PRIVILEGED_ROLES.contains(normalizedRole)) return true;
        if (!"READER".equals(normalizedRole)) return false;

        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalizedStatus)) return false;

        String normalizedKind = kind == null ? "" : kind.trim().toLowerCase(Locale.ROOT);
        return !normalizedKind.contains("внутрен");
    }

    public static void requireReadable(String role, DocumentResponse document) {
        if (document == null || !canRead(role, document.status(), document.kind())) {
            // Return the same response for missing and inaccessible records to avoid confirming
            // that a draft or internal document exists.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Документ не найден");
        }
    }
}
