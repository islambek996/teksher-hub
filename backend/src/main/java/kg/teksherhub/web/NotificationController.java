package kg.teksherhub.web;

import kg.teksherhub.user.UserAccount;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final JdbcTemplate jdbc;

    public NotificationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<NotificationView> list(@AuthenticationPrincipal UserAccount user) {
        return jdbc.query("""
                SELECT id, task_id, title, message, created_at, read_at
                FROM hub_notifications
                WHERE username = ?
                ORDER BY read_at NULLS FIRST, created_at DESC, id DESC
                LIMIT 100
                """, (rs, rowNum) -> {
            Timestamp readAt = rs.getTimestamp("read_at");
            Object taskId = rs.getObject("task_id");
            return new NotificationView(
                    rs.getLong("id"),
                    taskId == null ? null : ((Number) taskId).longValue(),
                    rs.getString("title"),
                    rs.getString("message"),
                    rs.getTimestamp("created_at").toInstant(),
                    readAt == null ? null : readAt.toInstant());
        }, user.getUsername());
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable long id,
                                         @AuthenticationPrincipal UserAccount user) {
        jdbc.update("""
                UPDATE hub_notifications SET read_at = NOW()
                WHERE id = ? AND username = ? AND read_at IS NULL
                """, id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserAccount user) {
        jdbc.update("UPDATE hub_notifications SET read_at = NOW() WHERE username = ? AND read_at IS NULL",
                user.getUsername());
        return ResponseEntity.noContent().build();
    }

    public record NotificationView(Long id, Long taskId, String title, String message,
                                   Instant createdAt, Instant readAt) {}
}
