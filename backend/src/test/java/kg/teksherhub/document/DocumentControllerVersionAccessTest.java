package kg.teksherhub.document;

import kg.teksherhub.user.UserAccount;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DocumentControllerVersionAccessTest {
    private final DocumentService service = mock(DocumentService.class);
    private final DocumentController controller = new DocumentController(service, mock(DocumentImportService.class));

    @Test
    void readerOnlyReceivesVersionsThatAreCurrentlyReadable() {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenReturn(document(id, "ACTIVE", "Нормативный акт"));
        when(service.history(id)).thenReturn(List.of(
                version(3, "ACTIVE", "Нормативный акт", "Публичная редакция"),
                version(2, "DRAFT", "Нормативный акт", "Содержимое черновика"),
                version(1, "ACTIVE", "Внутренний документ", "Внутреннее содержимое")
        ));

        List<VersionResponse> visible = controller.versions(id, user("READER"));

        assertEquals(1, visible.size());
        assertEquals("Публичная редакция", visible.get(0).content());
    }

    @Test
    void administratorCanReviewEveryHistoricalVersion() {
        UUID id = UUID.randomUUID();
        when(service.get(id)).thenReturn(document(id, "ACTIVE", "Нормативный акт"));
        when(service.history(id)).thenReturn(List.of(
                version(3, "ACTIVE", "Нормативный акт", "Публичная редакция"),
                version(2, "DRAFT", "Нормативный акт", "Содержимое черновика"),
                version(1, "ACTIVE", "Внутренний документ", "Внутреннее содержимое")
        ));

        List<VersionResponse> visible = controller.versions(id, user("ADMIN"));

        assertEquals(3, visible.size());
    }

    private static UserAccount user(String role) {
        UserAccount user = new UserAccount();
        user.setUsername("test-user");
        user.setRole(role);
        return user;
    }

    private static DocumentResponse document(UUID id, String status, String kind) {
        Instant now = Instant.now();
        return new DocumentResponse(id, "Тестовый материал", "KG", kind, "Общее", null, null,
                List.of(), null, null, null, null, null, "Описание", "Текущее содержимое",
                status, status, null, null, "author", "author", now, now, 3, 0, false);
    }

    private static VersionResponse version(int versionNumber, String status, String kind, String content) {
        return new VersionResponse((long) versionNumber, versionNumber, "Тестовый материал", "KG", kind,
                "Общее", null, null, List.of(), null, null, null, null, null,
                "Описание", content, status, status, null, "editor", Instant.now());
    }
}
