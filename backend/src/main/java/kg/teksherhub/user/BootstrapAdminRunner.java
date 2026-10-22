package kg.teksherhub.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapAdminRunner implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String username;
    private final String password;

    public BootstrapAdminRunner(UserRepository users, PasswordEncoder encoder,
            @Value("${app.bootstrap.admin-username:}") String username,
            @Value("${app.bootstrap.admin-password:}") String password) {
        this.users = users;
        this.encoder = encoder;
        this.username = username == null ? "" : username.trim();
        this.password = password == null ? "" : password;
    }

    @Override
    public void run(String... args) {
        if (username.isBlank() || password.isBlank()) {
            log.warn("Bootstrap admin not configured. Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD before first login.");
            return;
        }
        if (password.length() < 12 || password.toLowerCase().contains("replace-with")) {
            throw new IllegalStateException("Set a unique BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters; do not use the template placeholder");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            log.info("Bootstrap admin '{}' already exists; leaving stored account unchanged.", username);
            return;
        }
        UserAccount admin = new UserAccount();
        admin.setUsername(username);
        admin.setDisplayName("Администратор TEKSHER HUB");
        admin.setPasswordHash(encoder.encode(password));
        admin.setRole("ADMIN");
        admin.setEnabled(true);
        users.save(admin);
        log.info("Bootstrap administrator '{}' created. Keep the credentials in a secret manager.", username);
    }
}