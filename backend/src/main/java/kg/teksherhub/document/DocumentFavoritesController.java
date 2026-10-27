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
        return jdbc.query("""
                SELECT f.document_id::text, d.status, d.kind
                FROM user_document_favorites f
                JOIN documents d ON d.id = f.document_id
                WHERE f.username = ?
                ORDER BY f.created_at DESC
                """, (rs, rowNum) -> new FavoriteEntry(
                    rs.getString("document_id"), rs.getString("status"), rs.getString("kind")),
                user.getUsername()).stream()
                .filter(item -> DocumentReadAccessPolicy.canRead(user.getRole(), item.status(), item.kind()))
                .map(FavoriteEntry::documentId)
                .toList();
    }

    @PutMapping("/{documentId}")
    public ResponseEntity<Void> add(@PathVariable UUID documentId,
                                    @AuthenticationPrincipal UserAccount user) {
        List<FavoriteEntry> matches = jdbc.query(
                "SELECT id::text AS document_id, status, kind FROM documents WHERE id = ?",
                (rs, rowNum) -> new FavoriteEntry(
                        rs.getString("document_id"), rs.getString("status"), rs.getString("kind")),
                documentId);
        if (matches.isEmpty()
                || !DocumentReadAccessPolicy.canRead(user.getRole(), matches.get(0).status(), matches.get(0).kind())) {
            // Do not reveal whether a hidden draft/internal document exists.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Документ не найден.");
        }
        jdbc.update("""
                INSERT INTO user_document_favorites(username, document_id)
                VALUES (?, ?)
                ON CONFLICT (username, document_id) DO NOTHING
                """, user.getUsername(), documentId);
        return ResponseEntity.noContent().build();
    }

    record FavoriteEntry(String documentId, String status, String kind) {}

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> remove(@PathVariable UUID documentId,
                                       @AuthenticationPrincipal UserAccount user) {
        jdbc.update("DELETE FROM user_document_favorites WHERE username = ? AND document_id = ?",
                user.getUsername(), documentId);
        return ResponseEntity.noContent().build();
    }
}
