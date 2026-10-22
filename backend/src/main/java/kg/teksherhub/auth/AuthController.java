package kg.teksherhub.auth;

import kg.teksherhub.config.TokenService;
import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final TokenService tokens;

    public AuthController(AuthenticationManager authenticationManager, TokenService tokens) {
        this.authenticationManager = authenticationManager;
        this.tokens = tokens;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        UserAccount user = (UserAccount) auth.getPrincipal();
        return new LoginResponse(tokens.create(user), PublicUser.from(user));
    }

    @GetMapping("/me")
    public PublicUser me(@AuthenticationPrincipal UserAccount user) {
        return PublicUser.from(user);
    }

    public record LoginRequest(@NotBlank @Size(max = 120) String username, @NotBlank @Size(max = 200) String password) {}
    public record LoginResponse(String token, PublicUser user) {}
    public record PublicUser(Long id, String username, String displayName, String role) {
        static PublicUser from(UserAccount user) {
            return new PublicUser(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole());
        }
    }
}