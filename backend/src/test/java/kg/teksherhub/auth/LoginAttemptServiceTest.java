package kg.teksherhub.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LoginAttemptServiceTest {
    @Test
    void blocksAfterFiveFailedAttemptsAndReturnsRetryWindow() {
        LoginAttemptService service = new LoginAttemptService();

        for (int i = 0; i < 4; i++) {
            assertEquals(0, service.recordFailure("ExampleUser"));
        }

        long retryAfter = service.recordFailure("ExampleUser");

        assertTrue(retryAfter >= 1);
        assertTrue(retryAfter <= LoginAttemptService.LOCK_DURATION.toSeconds());
        assertTrue(service.secondsUntilAllowed("exampleuser") >= 1);
    }

    @Test
    void normalizesUsernameAndClearsFailuresAfterSuccess() {
        LoginAttemptService service = new LoginAttemptService();

        for (int i = 0; i < 4; i++) {
            service.recordFailure("  ExampleUser ");
        }
        service.recordSuccess("EXAMPLEUSER");

        assertEquals(0, service.secondsUntilAllowed("exampleuser"));
        assertEquals(0, service.recordFailure("exampleuser"));
    }

    @Test
    void tracksDifferentUsernamesSeparately() {
        LoginAttemptService service = new LoginAttemptService();

        for (int i = 0; i < 5; i++) {
            service.recordFailure("user-a");
        }

        assertTrue(service.secondsUntilAllowed("user-a") > 0);
        assertEquals(0, service.secondsUntilAllowed("user-b"));
    }
}
