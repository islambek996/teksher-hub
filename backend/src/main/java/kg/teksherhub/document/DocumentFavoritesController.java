package kg.teksherhub.document;

import kg.teksherhub.user.UserAccount;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/favorites")
public class DocumentFavoritesController {
    private final JdbcTemplate jdbc;

    public DocumentFavoritesController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<String> list(@AuthenticationPrincipal UserAccount user) {
        return jdbc.query(
                "SELECT document_id::text FROM user_document_favorites WHERE username = ? ORDER BY created_at DESC",
                (rs, rowNum) -> rs.getString(1),
                user.getUsername());
    }

    @PutMapping("/{documentId}")
    public ResponseEntity<Void> add(@PathVariable UUID documentId,
                                    @AuthenticationPrincipal UserAccount user) {
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM documents WHERE id = ?", Integer.class, documentId);
        if (exists == null || exists == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Документ не найден.");
        }
        jdbc.update("""
                INSERT INTO user_document_favorites(username, document_id)
                VALUES (?, ?)
                ON CONFLICT (username, document_id) DO NOTHING
                """, user.getUsername(), documentId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> remove(@PathVariable UUID documentId,
                                       @AuthenticationPrincipal UserAccount user) {
        jdbc.update("DELETE FROM user_document_favorites WHERE username = ? AND document_id = ?",
                user.getUsername(), documentId);
        return ResponseEntity.noContent().build();
    }
}
