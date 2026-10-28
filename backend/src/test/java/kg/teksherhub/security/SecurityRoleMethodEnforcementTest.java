package kg.teksherhub.security;

import kg.teksherhub.document.StorageBackupController;
import kg.teksherhub.web.AuditLogController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@SpringJUnitConfig(SecurityRoleMethodEnforcementTest.TestConfig.class)
class SecurityRoleMethodEnforcementTest {

    private final AuditLogController auditLogController;
    private final StorageBackupController storageBackupController;

    SecurityRoleMethodEnforcementTest(AuditLogController auditLogController,
                                      StorageBackupController storageBackupController) {
        this.auditLogController = auditLogController;
        this.storageBackupController = storageBackupController;
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void readerCannotReadAuditLog() {
        authenticateAs("ROLE_READER");
        assertThrows(AccessDeniedException.class, () -> auditLogController.list(10));
    }

    @Test
    void editorCannotReadAuditLog() {
        authenticateAs("ROLE_EDITOR");
        assertThrows(AccessDeniedException.class, () -> auditLogController.list(10));
    }

    @Test
    void editorCannotExportStorageBackup() {
        authenticateAs("ROLE_EDITOR");
        assertThrows(AccessDeniedException.class, storageBackupController::exportUploads);
    }

    @Test
    void adminCanPassAuditLogMethodAuthorization() {
        authenticateAs("ROLE_ADMIN");
        assertDoesNotThrow(() -> auditLogController.list(10));
    }

    private static void authenticateAs(String role) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                "security-test-user", "n/a", List.of(new SimpleGrantedAuthority(role)));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        JdbcTemplate jdbcTemplate() {
            return mock(JdbcTemplate.class);
        }

        @Bean
        AuditLogController auditLogController(JdbcTemplate jdbc) {
            return new AuditLogController(jdbc);
        }

        @Bean
        StorageBackupController storageBackupController() {
            return new StorageBackupController(System.getProperty("java.io.tmpdir"));
        }
    }
}
