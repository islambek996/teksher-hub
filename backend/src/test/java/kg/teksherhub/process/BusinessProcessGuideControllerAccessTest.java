package kg.teksherhub.process;

import kg.teksherhub.user.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BusinessProcessGuideControllerAccessTest {
    private final BusinessProcessGuideService service = mock(BusinessProcessGuideService.class);
    private final BusinessProcessGuideController controller = new BusinessProcessGuideController(service);

    @Test
    void readerOnlySeesPublishedSnapshotsInVersionList() {
        when(service.isPublished("process-1")).thenReturn(true);
        when(service.versions("process-1")).thenReturn(List.of(
                version(3, "PUBLISHED"),
                version(2, null),
                version(1, "DRAFT")
        ));

        List<BusinessProcessGuideService.GuideVersion> visible =
                controller.versions("process-1", user("READER"));

        assertEquals(1, visible.size());
        assertEquals(3, visible.get(0).versionNumber());
    }

    @Test
    void readerCannotOpenSnapshotWithUnknownPublicationStatus() {
        when(service.isPublished("process-1")).thenReturn(true);
        when(service.versionDetail("process-1", 1)).thenReturn(
                new BusinessProcessGuideResponse("process-1", "Категория", "Материал", "Описание",
                        "МЗКМ", "5 минут", "поиск", List.of(), List.of(), 1, "author", "editor",
                        Instant.now(), null, null, null, null, null, null));

        assertThrows(AccessDeniedException.class,
                () -> controller.versionDetail("process-1", 1, user("READER")));
    }

    @Test
    void administratorCanOpenSnapshotWithUnknownPublicationStatus() {
        BusinessProcessGuideResponse snapshot = new BusinessProcessGuideResponse(
                "process-1", "Категория", "Материал", "Описание", "МЗКМ", "5 минут", "поиск",
                List.of(), List.of(), 1, "author", "editor", Instant.now(), null, null, null, null, null, null);
        when(service.versionDetail("process-1", 1)).thenReturn(snapshot);

        assertSame(snapshot, controller.versionDetail("process-1", 1, user("ADMIN")));
    }

    private static BusinessProcessGuideService.GuideVersion version(int number, String status) {
        return new BusinessProcessGuideService.GuideVersion(number, "UPDATE", "Версия " + number,
                "editor", Instant.now(), 3, 0, status);
    }

    private static UserAccount user(String role) {
        UserAccount user = new UserAccount();
        user.setUsername("test-user");
        user.setRole(role);
        return user;
    }
}
