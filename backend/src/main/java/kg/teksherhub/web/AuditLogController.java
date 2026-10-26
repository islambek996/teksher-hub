package kg.teksherhub.web;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/audit-log")
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {
    private final JdbcTemplate jdbc;

    public AuditLogController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<AuditLogEntry> list(@RequestParam(defaultValue = "100") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return jdbc.query("""
                SELECT id, username, action, entity_type, entity_id, entity_label, details, created_at
                FROM audit_log
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new AuditLogEntry(
                        rs.getLong("id"),
                        rs.getString("username"),
                        rs.getString("action"),
                        rs.getString("entity_type"),
                        rs.getString("entity_id"),
                        rs.getString("entity_label"),
                        rs.getString("details"),
                        rs.getTimestamp("created_at").toInstant()),
                safeLimit);
    }

    public record AuditLogEntry(
            Long id,
            String username,
            String action,
            String entityType,
            String entityId,
            String entityLabel,
            String details,
            Instant createdAt
    ) {}
}
