package kg.teksherhub.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserAdminController {
    private final UserRepository users;
    private final PasswordEncoder encoder;

    public UserAdminController(UserRepository users, PasswordEncoder encoder) {
        this.users = users;
        this.encoder = encoder;
    }

    @GetMapping
    public List<UserView> list() {
        return users.findAll().stream().map(UserView::from).toList();
    }

    @PostMapping
    public UserView create(@Valid @RequestBody CreateUserRequest request) {
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
        return UserView.from(users.save(user));
    }

    @PatchMapping("/{id}/enabled")
    public UserView setEnabled(@PathVariable Long id, @RequestBody EnabledRequest request,
                               @AuthenticationPrincipal UserAccount actingUser) {
        UserAccount user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("Пользователь не найден"));
        if (user.getId().equals(actingUser.getId()) && !request.enabled()) {
            throw new IllegalArgumentException("Нельзя отключить собственную учётную запись администратора");
        }
        user.setEnabled(request.enabled());
        return UserView.from(users.save(user));
    }

    public record CreateUserRequest(@NotBlank @Size(max = 120) String username,
                                    @NotBlank @Size(max = 180) String displayName,
                                    @NotBlank @Size(min = 12, max = 200) String password,
                                    @NotBlank @Pattern(regexp = "ADMIN|EDITOR|READER") String role) {}
    public record EnabledRequest(boolean enabled) {}
    public record UserView(Long id, String username, String displayName, String role, boolean enabled) {
        static UserView from(UserAccount u) { return new UserView(u.getId(), u.getUsername(), u.getDisplayName(), u.getRole(), u.isEnabled()); }
    }
}