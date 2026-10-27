package kg.teksherhub.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenServiceTest {
    private static final String TEST_SECRET = "test-only-signing-secret-with-more-than-32-bytes";

    @Test
    void rejectsMissingOrWeakSigningSecret() {
        assertThrows(IllegalArgumentException.class, () -> new TokenService("", 480));
        assertThrows(IllegalArgumentException.class, () -> new TokenService("short", 480));
    }

    @Test
    void createsAndValidatesSignedTokenForMatchingUser() {
        TokenService service = new TokenService(TEST_SECRET, 60);
        UserDetails user = User.withUsername("test-user")
                .password("not-used-in-token-test")
                .roles("READER")
                .build();

        String token = service.create(user);

        assertTrue(service.isValid(token, user));
        assertEquals("test-user", service.username(token));
    }

    @Test
    void passwordResetOrAccountToggleInvalidatesPreviouslyIssuedTokens() {
        TokenService service = new TokenService(TEST_SECRET, 60);
        kg.teksherhub.user.UserAccount user = new kg.teksherhub.user.UserAccount();
        user.setUsername("test-user");
        user.setPasswordHash("bcrypt-hash-is-not-embedded-in-token");
        user.setRole("READER");
        user.setTokenVersion(4L);

        String token = service.create(user);
        assertTrue(service.isValid(token, user));

        user.setTokenVersion(5L);
        assertEquals(false, service.isValid(token, user));
    }
}
