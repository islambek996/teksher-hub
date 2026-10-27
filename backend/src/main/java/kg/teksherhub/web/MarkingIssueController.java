package kg.teksherhub.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import kg.teksherhub.user.UserAccount;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/marking-issues")
public class MarkingIssueController {
    private static final String COLUMNS = "id, title, description, category, system_name, jurisdiction, product_group, priority, status, assigned_to, created_by, resolution, created_at, updated_at, resolved_at";
    private final JdbcTemplate jdbc;

    public MarkingIssueController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public List<IssueView> list(@RequestParam(required = false) String status,
                                @RequestParam(required = false) String category,
                                @RequestParam(required = false) String q,
                                @AuthenticationPrincipal UserAccount user) {
        String normalizedStatus = status == null ? "" : status.trim().toUpperCase();
        String normalizedCategory = category == null ? "" : category.trim().toUpperCase();
        String search = q == null ? "" : q.trim().toLowerCase();
        if (!normalizedStatus.isEmpty() && !List.of("NEW","IN_PROGRESS","WAITING","RESOLVED","CLOSED").contains(normalizedStatus))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестный статус обращения.");
        if (!normalizedCategory.isEmpty() && !List.of("TECHNICAL","REGULATORY","PRODUCT_CARD","CODE_ORDER","APPLICATION","CODE_MOVEMENT","OTHER").contains(normalizedCategory))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная категория обращения.");
        return jdbc.query("SELECT " + COLUMNS + " FROM marking_issues WHERE (? = '' OR status = ?) AND (? = '' OR category = ?) AND (? = '' OR LOWER(title || ' ' || description || ' ' || COALESCE(product_group,'') || ' ' || COALESCE(assigned_to,'')) LIKE ?) ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, CASE status WHEN 'NEW' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'WAITING' THEN 2 ELSE 3 END, updated_at DESC LIMIT 500",
            (rs, rowNum) -> mapIssue(rs), normalizedStatus, normalizedStatus, normalizedCategory, normalizedCategory, search, "%" + search + "%");
    }

    @PostMapping
    public IssueView create(@Valid @RequestBody IssueRequest request, @AuthenticationPrincipal UserAccount user) {
        String title = request.title().trim();
        String description = request.description() == null ? "" : request.description().trim();
        String resolution = request.resolution() == null ? "" : request.resolution().trim();
        String category = normalize(request.category(), List.of("TECHNICAL","REGULATORY","PRODUCT_CARD","CODE_ORDER","APPLICATION","CODE_MOVEMENT","OTHER"), "TECHNICAL", "категория");
        String system = normalize(request.system(), List.of("MZKM","GAIS_MT","TRANSGRAN","CROSS_BORDER","OTHER"), "MZKM", "система");
        String jurisdiction = normalize(request.jurisdiction(), List.of("KG","RU","EAEU"), "KG", "юрисдикция");
        String priority = normalize(request.priority(), List.of("LOW","NORMAL","HIGH","CRITICAL"), "NORMAL", "приоритет");
        String assignee = request.assignedTo() == null || request.assignedTo().isBlank() ? null : request.assignedTo().trim();
        if (assignee != null && !canAssign(user)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Назначать ответственного могут редакторы и администраторы.");
        if (assignee != null) {
            List<String> users = jdbc.query("SELECT username FROM users WHERE LOWER(username) = LOWER(?) AND enabled = TRUE",
                    (rs, rowNum) -> rs.getString(1), assignee);
            if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пользователь-ответственный не найден или отключён.");
            assignee = users.get(0);
        }
        Long id = jdbc.queryForObject("""
            INSERT INTO marking_issues(title, description, category, system_name, jurisdiction, product_group, priority, status, assigned_to, resolution, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, NOW(), NOW()) RETURNING id
            """, Long.class, title, description, category, system, jurisdiction,
                blankToNull(request.productGroup()), priority, assignee, resolution, user.getUsername());
        audit(user, "CREATE", id, title, "Зарегистрирована проблема маркировки");
        return getOne(id);
    }

    @PatchMapping("/{id}")
    public IssueView update(@PathVariable long id, @Valid @RequestBody IssueUpdateRequest request,
                            @AuthenticationPrincipal UserAccount user) {
        IssueView old = getOne(id);
        if (!canManage(user) && !old.createdBy().equalsIgnoreCase(user.getUsername())
                && (old.assignedTo() == null || !old.assignedTo().equalsIgnoreCase(user.getUsername()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Изменять запись могут её автор, ответственный, редактор или администратор.");
        }
        String title = request.title() == null ? old.title() : request.title().trim();
        String description = request.description() == null ? old.description() : request.description().trim();
        String category = request.category() == null ? old.category() : normalize(request.category(), List.of("TECHNICAL","REGULATORY","PRODUCT_CARD","CODE_ORDER","APPLICATION","CODE_MOVEMENT","OTHER"), old.category(), "категория");
        String system = request.system() == null ? old.system() : normalize(request.system(), List.of("MZKM","GAIS_MT","TRANSGRAN","CROSS_BORDER","OTHER"), old.system(), "система");
        String jurisdiction = request.jurisdiction() == null ? old.jurisdiction() : normalize(request.jurisdiction(), List.of("KG","RU","EAEU"), old.jurisdiction(), "юрисдикция");
        String priority = request.priority() == null ? old.priority() : normalize(request.priority(), List.of("LOW","NORMAL","HIGH","CRITICAL"), old.priority(), "приоритет");
        String status = request.status() == null ? old.status() : normalize(request.status(), List.of("NEW","IN_PROGRESS","WAITING","RESOLVED","CLOSED"), old.status(), "статус");
        String productGroup = request.productGroup() == null ? old.productGroup() : blankToNull(request.productGroup());
        String assignee = old.assignedTo();
        if (request.assignedTo() != null) {
            if (!canAssign(user)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Назначать ответственного могут редакторы и администраторы.");
            assignee = blankToNull(request.assignedTo());
            if (assignee != null) {
                List<String> users = jdbc.query("SELECT username FROM users WHERE LOWER(username) = LOWER(?) AND enabled = TRUE", (rs, rowNum) -> rs.getString(1), assignee);
                if (users.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Пользователь-ответственный не найден или отключён.");
                assignee = users.get(0);
            }
        }
        String resolution = request.resolution() == null ? old.resolution() : request.resolution().trim();
        jdbc.update("""
            UPDATE marking_issues SET title=?, description=?, category=?, system_name=?, jurisdiction=?, product_group=?, priority=?, status=?, assigned_to=?, resolution=?, updated_at=NOW(),
            resolved_at=CASE WHEN ? IN ('RESOLVED','CLOSED') THEN COALESCE(resolved_at,NOW()) ELSE NULL END WHERE id=?
            """, title, description, category, system, jurisdiction, productGroup, priority, status, assignee, resolution, status, id);
        audit(user, "UPDATE", id, title, "Статус: " + status + "; приоритет: " + priority);
        return getOne(id);
    }

    @GetMapping("/{id}/comments")
    public List<IssueComment> comments(@PathVariable long id) {
        getOne(id);
        return jdbc.query("SELECT id, issue_id, username, body, created_at FROM marking_issue_comments WHERE issue_id=? ORDER BY created_at ASC, id ASC",
                (rs, rowNum) -> new IssueComment(rs.getLong("id"), rs.getLong("issue_id"), rs.getString("username"), rs.getString("body"), rs.getTimestamp("created_at").toInstant()), id);
    }

    @PostMapping("/{id}/comments")
    public IssueComment addComment(@PathVariable long id, @Valid @RequestBody CommentRequest request,
                                   @AuthenticationPrincipal UserAccount user) {
        IssueView issue = getOne(id);
        Long commentId = jdbc.queryForObject("INSERT INTO marking_issue_comments(issue_id, username, body, created_at) VALUES (?, ?, ?, NOW()) RETURNING id",
                Long.class, id, user.getUsername(), request.body().trim());
        jdbc.update("UPDATE marking_issues SET updated_at=NOW() WHERE id=?", id);
        audit(user, "COMMENT", id, issue.title(), "Добавлен комментарий к проблеме");
        return jdbc.queryForObject("SELECT id, issue_id, username, body, created_at FROM marking_issue_comments WHERE id=?",
                (rs, rowNum) -> new IssueComment(rs.getLong("id"), rs.getLong("issue_id"), rs.getString("username"), rs.getString("body"), rs.getTimestamp("created_at").toInstant()), commentId);
    }

    private IssueView getOne(long id) {
        List<IssueView> rows = jdbc.query("SELECT " + COLUMNS + " FROM marking_issues WHERE id=?", (rs, rowNum) -> mapIssue(rs), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Проблема маркировки не найдена.");
        return rows.get(0);
    }

    private static IssueView mapIssue(ResultSet rs) throws SQLException {
        Timestamp resolved = rs.getTimestamp("resolved_at");
        return new IssueView(rs.getLong("id"), rs.getString("title"), rs.getString("description"), rs.getString("category"),
                rs.getString("system_name"), rs.getString("jurisdiction"), rs.getString("product_group"), rs.getString("priority"),
                rs.getString("status"), rs.getString("assigned_to"), rs.getString("created_by"), rs.getString("resolution"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(), resolved == null ? null : resolved.toInstant());
    }

    private void audit(UserAccount user, String action, long id, String title, String details) {
        jdbc.update("INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at) VALUES (?, ?, 'MARKING_ISSUE', ?, ?, ?, NOW())",
                user.getUsername(), action, Long.toString(id), title, details);
    }

    private static boolean canManage(UserAccount user) { return "ADMIN".equals(user.getRole()) || "EDITOR".equals(user.getRole()); }
    private static boolean canAssign(UserAccount user) { return canManage(user); }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static String normalize(String value, List<String> allowed, String fallback, String label) {
        String normalized = value == null || value.isBlank() ? fallback : value.trim().toUpperCase();
        if (!allowed.contains(normalized)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректное значение: " + label + ".");
        return normalized;
    }

    public record IssueRequest(@NotBlank @Size(max=240) String title, @Size(max=4000) String description,
            @Pattern(regexp="TECHNICAL|REGULATORY|PRODUCT_CARD|CODE_ORDER|APPLICATION|CODE_MOVEMENT|OTHER|technical|regulatory|product_card|code_order|application|code_movement|other") String category,
            @Pattern(regexp="MZKM|GAIS_MT|TRANSGRAN|CROSS_BORDER|OTHER|mzkm|gais_mt|transgran|cross_border|other") String system,
            @Pattern(regexp="KG|RU|EAEU|kg|ru|eaeu") String jurisdiction,
            @Size(max=240) String productGroup,
            @Pattern(regexp="LOW|NORMAL|HIGH|CRITICAL|low|normal|high|critical") String priority,
            @Size(max=120) String assignedTo, @Size(max=3000) String resolution) {}
    public record IssueUpdateRequest(@Size(max=240) String title, @Size(max=4000) String description,
            @Pattern(regexp="TECHNICAL|REGULATORY|PRODUCT_CARD|CODE_ORDER|APPLICATION|CODE_MOVEMENT|OTHER|technical|regulatory|product_card|code_order|application|code_movement|other") String category,
            @Pattern(regexp="MZKM|GAIS_MT|TRANSGRAN|CROSS_BORDER|OTHER|mzkm|gais_mt|transgran|cross_border|other") String system,
            @Pattern(regexp="KG|RU|EAEU|kg|ru|eaeu") String jurisdiction,
            @Size(max=240) String productGroup,
            @Pattern(regexp="LOW|NORMAL|HIGH|CRITICAL|low|normal|high|critical") String priority,
            @Pattern(regexp="NEW|IN_PROGRESS|WAITING|RESOLVED|CLOSED|new|in_progress|waiting|resolved|closed") String status,
            @Size(max=120) String assignedTo, @Size(max=3000) String resolution) {}
    public record CommentRequest(@NotBlank @Size(max=3000) String body) {}
    public record IssueComment(Long id, Long issueId, String username, String body, Instant createdAt) {}
    public record IssueView(Long id, String title, String description, String category, String system, String jurisdiction,
            String productGroup, String priority, String status, String assignedTo, String createdBy, String resolution,
            Instant createdAt, Instant updatedAt, Instant resolvedAt) {}
}
