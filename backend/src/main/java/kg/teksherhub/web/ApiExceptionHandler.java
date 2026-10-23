package kg.teksherhub.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage()).findFirst().orElse("Некорректные данные");
        return ResponseEntity.badRequest().body(Map.of("timestamp", Instant.now(), "error", message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<?> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("timestamp", Instant.now(), "error", ex.getMessage() == null ? "Некорректный запрос" : ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<?> invalidCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("timestamp", Instant.now(), "error", "Неверный логин или пароль"));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<?> conflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("timestamp", Instant.now(), "error", ex.getMessage()));
    }
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> responseStatus(ResponseStatusException ex) {
        String message = ex.getReason() == null ? "Запрос не выполнен" : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("timestamp", Instant.now(), "error", message));
    }

}