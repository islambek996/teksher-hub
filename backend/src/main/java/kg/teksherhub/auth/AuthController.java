package kg.teksherhub.auth;

import kg.teksherhub.config.TokenService;
import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final TokenService tokens;
    private final LoginAttemptService loginAttempts;

    public AuthController(AuthenticationManager authenticationManager, TokenService tokens,
                          LoginAttemptService loginAttempts) {
        this.authenticationManager = authenticationManager;
        this.tokens = tokens;
        this.loginAttempts = loginAttempts;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        long retryAfter = loginAttempts.secondsUntilAllowed(request.username());
        if (retryAfter > 0) return tooManyRequests(retryAfter);

        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
            UserAccount user = (UserAccount) auth.getPrincipal();
            loginAttempts.recordSuccess(request.username());
            return ResponseEntity.ok(new LoginResponse(tokens.create(user), PublicUser.from(user)));
        } catch (AuthenticationException ex) {
            retryAfter = loginAttempts.recordFailure(request.username());
            if (retryAfter > 0) return tooManyRequests(retryAfter);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    private ResponseEntity<LoginResponse> tooManyRequests(long seconds) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(seconds)).build();
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
