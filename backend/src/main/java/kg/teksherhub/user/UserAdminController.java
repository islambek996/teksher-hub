package kg.teksherhub.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserAdminController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;

    public UserAdminController(UserRepository users, PasswordEncoder encoder, JdbcTemplate jdbc) {
        this.users = users;
        this.encoder = encoder;
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<UserView> list() {
        return users.findAll().stream().map(UserView::from).toList();
    }

    @PostMapping
    public UserView create(@Valid @RequestBody CreateUserRequest request,
                           @AuthenticationPrincipal UserAccount actingUser) {
        String username = request.username().trim();
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Пользователь с таким логином уже существует");
        }
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(encoder.encode(request.password()));
        user.setRole(request.role());
        user.setEnabled(true);
        UserAccount saved = users.save(user);
        audit(actingUser.getUsername(), "CREATE_USER", saved.getId(), saved.getUsername(), "Создан пользователь с ролью " + saved.getRole());
        return UserView.from(saved);
    }

    @PutMapping("/{id}/password")
    public UserView resetPassword(@PathVariable Long id, @Valid @RequestBody PasswordResetRequest request,
                                  @AuthenticationPrincipal UserAccount actingUser) {
        UserAccount user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("Пользователь не найден"));
        user.setPasswordHash(encoder.encode(request.password()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        UserAccount saved = users.save(user);
        audit(actingUser.getUsername(), "RESET_PASSWORD", saved.getId(), saved.getUsername(), "Администратор сбросил пароль пользователя");
        return UserView.from(saved);
    }

    @PatchMapping("/{id}/enabled")
    public UserView setEnabled(@PathVariable Long id, @RequestBody EnabledRequest request,
                               @AuthenticationPrincipal UserAccount actingUser) {
        UserAccount user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("Пользователь не найден"));
        if (user.getId().equals(actingUser.getId()) && !request.enabled()) {
            throw new IllegalArgumentException("Нельзя отключить собственную учётную запись администратора");
        }
        if (user.isEnabled() != request.enabled()) {
            user.setEnabled(request.enabled());
            user.setTokenVersion(user.getTokenVersion() + 1);
        }
        UserAccount saved = users.save(user);
        audit(actingUser.getUsername(), request.enabled() ? "ENABLE_USER" : "DISABLE_USER",
                saved.getId(), saved.getUsername(), request.enabled() ? "Учётная запись включена" : "Учётная запись отключена");
        return UserView.from(saved);
    }

    private void audit(String actor, String action, Long targetId, String targetUsername, String details) {
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, ?, 'USER', ?, ?, ?, NOW())
                """, actor, action, String.valueOf(targetId), targetUsername, details);
    }

    public record CreateUserRequest(@NotBlank @Size(max = 120) String username,
                                    @NotBlank @Size(max = 180) String displayName,
                                    @NotBlank @Size(min = 12, max = 200) String password,
                                    @NotBlank @Pattern(regexp = "ADMIN|EDITOR|READER") String role) {}
    public record PasswordResetRequest(@NotBlank @Size(min = 12, max = 200) String password) {}
    public record EnabledRequest(boolean enabled) {}
    public record UserView(Long id, String username, String displayName, String role, boolean enabled) {
        static UserView from(UserAccount u) { return new UserView(u.getId(), u.getUsername(), u.getDisplayName(), u.getRole(), u.isEnabled()); }
    }
}