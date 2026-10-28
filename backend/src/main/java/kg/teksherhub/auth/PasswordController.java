package kg.teksherhub.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import kg.teksherhub.user.UserAccount;
import kg.teksherhub.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class PasswordController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;

    public PasswordController(UserRepository users, PasswordEncoder encoder, JdbcTemplate jdbc) {
        this.users = users;
        this.encoder = encoder;
        this.jdbc = jdbc;
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal UserAccount currentUser,
                               @Valid @RequestBody ChangePasswordRequest request) {
        if (!encoder.matches(request.currentPassword(), currentUser.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Текущий пароль указан неверно");
        }
        if (encoder.matches(request.newPassword(), currentUser.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Новый пароль должен отличаться от текущего");
        }

        UserAccount user = users.findById(currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Учётная запись не найдена"));
        user.setPasswordHash(encoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        users.save(user);

        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'CHANGE_OWN_PASSWORD', 'USER', ?, ?, 'Пользователь самостоятельно изменил пароль', NOW())
                """, user.getUsername(), String.valueOf(user.getId()), user.getUsername());
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 200) String currentPassword,
            @NotBlank @Size(min = 12, max = 200) String newPassword) {}
}
