package kg.teksherhub.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import kg.teksherhub.user.UserAccount;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private static final String SELECT_COLUMNS = """
            id, title, description, status, priority, due_date, created_by, assigned_to, created_at, updated_at
            """;
    private static final RowMapper<TaskView> ROW_MAPPER = TaskController::mapRow;
    private final JdbcTemplate jdbc;

    public TaskController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<TaskView> list(@AuthenticationPrincipal UserAccount user) {
        if ("ADMIN".equals(user.getRole())) {
            return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM hub_tasks ORDER BY CASE status WHEN 'IN_PROGRESS' THEN 0 WHEN 'TODO' THEN 1 ELSE 2 END, due_date NULLS LAST, updated_at DESC",
                    ROW_MAPPER);
        }
        return jdbc.query("SELECT " + SELECT_COLUMNS + " FROM hub_tasks WHERE assigned_to = ? OR created_by = ? ORDER BY CASE status WHEN 'IN_PROGRESS' THEN 0 WHEN 'TODO' THEN 1 ELSE 2 END, due_date NULLS LAST, updated_at DESC",
                ROW_MAPPER, user.getUsername(), user.getUsername());
    }

    @PostMapping
    public TaskView create(@Valid @RequestBody TaskRequest request,
                           @AuthenticationPrincipal UserAccount user) {
        String title = request.title().trim();
        String description = request.description() == null ? "" : request.description().trim();
        String status = normalizeStatus(request.status());
        String priority = normalizePriority(request.priority());
        String assignedTo = request.assignedTo() == null || request.assignedTo().isBlank()
                ? user.getUsername() : request.assignedTo().trim();

        if (!"ADMIN".equals(user.getRole()) && !"EDITOR".equals(user.getRole())
                && !assignedTo.equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Назначать задачи другим пользователям могут только редакторы и администраторы.");
        }
        List<String> matchingAssignees = jdbc.query(
                "SELECT username FROM users WHERE LOWER(username) = LOWER(?) AND enabled = TRUE",
                (rs, rowNum) -> rs.getString("username"), assignedTo);
        if (matchingAssignees.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Назначенный пользователь не найден или отключён.");
        }
        assignedTo = matchingAssignees.get(0);

        Long id = jdbc.queryForObject("""
                INSERT INTO hub_tasks(title, description, status, priority, due_date, created_by, assigned_to, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                RETURNING id
                """, Long.class, title, description, status, priority, request.dueDate(),
                user.getUsername(), assignedTo);
        audit(user.getUsername(), "CREATE", id, title, "Создана задача; исполнитель: " + assignedTo);
        if (!assignedTo.equalsIgnoreCase(user.getUsername())) {
            notifyUser(assignedTo, id, "Новое поручение", user.getUsername() + " назначил вам задачу: «" + title + "»");
        }
        return getOne(id);
    }

    @PatchMapping("/{id}")
    public TaskView update(@PathVariable long id, @Valid @RequestBody TaskUpdateRequest request,
                           @AuthenticationPrincipal UserAccount user) {
        TaskView existing = getOne(id);
        ensureCanEdit(existing, user);
        String title = request.title() == null ? existing.title() : request.title().trim();
        String description = request.description() == null ? existing.description() : request.description().trim();
        String status = request.status() == null ? existing.status() : normalizeStatus(request.status());
        String priority = request.priority() == null ? existing.priority() : normalizePriority(request.priority());
        LocalDate dueDate = request.dueDate() == null ? existing.dueDate() : request.dueDate();

        jdbc.update("""
                UPDATE hub_tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, updated_at = NOW()
                WHERE id = ?
                """, title, description, status, priority, dueDate, id);
        audit(user.getUsername(), "UPDATE", id, title, "Обновлена задача");
        if (!existing.status().equals(status)) {
            String recipient = !existing.createdBy().equalsIgnoreCase(user.getUsername())
                    ? existing.createdBy()
                    : (!existing.assignedTo().equalsIgnoreCase(user.getUsername()) ? existing.assignedTo() : null);
            if (recipient != null) {
                notifyUser(recipient, id, "Изменён статус задачи", user.getUsername() + " изменил статус задачи «" + title + "» на " + statusLabel(status));
            }
        }
        return getOne(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id, @AuthenticationPrincipal UserAccount user) {
        TaskView existing = getOne(id);
        if (!"ADMIN".equals(user.getRole()) && !existing.createdBy().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Удалить задачу может её автор или администратор.");
        }
        jdbc.update("DELETE FROM hub_tasks WHERE id = ?", id);
        audit(user.getUsername(), "DELETE", id, existing.title(), "Задача удалена");
    }

    @GetMapping("/{id}/comments")
    public List<TaskComment> comments(@PathVariable long id, @AuthenticationPrincipal UserAccount user) {
        TaskView task = getOne(id);
        ensureCanEdit(task, user);
        return jdbc.query("""
                SELECT id, task_id, username, body, created_at
                FROM hub_task_comments WHERE task_id = ? ORDER BY created_at ASC, id ASC
                """, (rs, rowNum) -> new TaskComment(rs.getLong("id"), rs.getLong("task_id"),
                rs.getString("username"), rs.getString("body"), rs.getTimestamp("created_at").toInstant()), id);
    }

    @PostMapping("/{id}/comments")
    public TaskComment addComment(@PathVariable long id, @Valid @RequestBody TaskCommentRequest request,
                                  @AuthenticationPrincipal UserAccount user) {
        TaskView task = getOne(id);
        ensureCanEdit(task, user);
        String body = request.body().trim();
        Long commentId = jdbc.queryForObject("""
                INSERT INTO hub_task_comments(task_id, username, body, created_at)
                VALUES (?, ?, ?, NOW()) RETURNING id
                """, Long.class, id, user.getUsername(), body);
        audit(user.getUsername(), "COMMENT", id, task.title(), "Добавлен комментарий к задаче");
        Set<String> recipients = Set.of(task.createdBy(), task.assignedTo());
        recipients.stream().filter(recipient -> !recipient.equalsIgnoreCase(user.getUsername())).distinct()
                .forEach(recipient -> notifyUser(recipient, id, "Новый комментарий к задаче",
                        user.getUsername() + " прокомментировал задачу «" + task.title() + "»"));
        return jdbc.queryForObject("""
                SELECT id, task_id, username, body, created_at FROM hub_task_comments WHERE id = ?
                """, (rs, rowNum) -> new TaskComment(rs.getLong("id"), rs.getLong("task_id"),
                rs.getString("username"), rs.getString("body"), rs.getTimestamp("created_at").toInstant()), commentId);
    }

    private void notifyUser(String username, Long taskId, String title, String message) {
        jdbc.update("""
                INSERT INTO hub_notifications(username, task_id, title, message, created_at)
                VALUES (?, ?, ?, ?, NOW())
                """, username, taskId, title, message);
    }

    private static String statusLabel(String status) {
        return switch (status) {
            case "IN_PROGRESS" -> "В работе";
            case "DONE" -> "Выполнено";
            default -> "К выполнению";
        };
    }

    private TaskView getOne(long id) {
        List<TaskView> rows = jdbc.query("SELECT " + SELECT_COLUMNS + " FROM hub_tasks WHERE id = ?", ROW_MAPPER, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Задача не найдена.");
        return rows.get(0);
    }

    private static void ensureCanEdit(TaskView task, UserAccount user) {
        if ("ADMIN".equals(user.getRole())) return;
        if (task.createdBy().equalsIgnoreCase(user.getUsername()) || task.assignedTo().equalsIgnoreCase(user.getUsername())) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Изменять задачу могут её автор, исполнитель или администратор.");
    }

    private void audit(String username, String action, long id, String title, String details) {
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, ?, 'TASK', ?, ?, ?, NOW())
                """, username, action, Long.toString(id), title, details);
    }

    private static String normalizeStatus(String value) {
        String status = value == null || value.isBlank() ? "TODO" : value.trim().toUpperCase();
        if (!List.of("TODO", "IN_PROGRESS", "DONE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Статус задачи должен быть TODO, IN_PROGRESS или DONE.");
        }
        return status;
    }

    private static String normalizePriority(String value) {
        String priority = value == null || value.isBlank() ? "NORMAL" : value.trim().toUpperCase();
        if (!List.of("LOW", "NORMAL", "HIGH").contains(priority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Приоритет задачи должен быть LOW, NORMAL или HIGH.");
        }
        return priority;
    }

    private static TaskView mapRow(ResultSet rs, int rowNum) throws SQLException {
        java.sql.Date due = rs.getDate("due_date");
        return new TaskView(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("description"),
                rs.getString("status"),
                rs.getString("priority"),
                due == null ? null : due.toLocalDate(),
                rs.getString("created_by"),
                rs.getString("assigned_to"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    public record TaskRequest(
            @NotBlank @Size(max = 240) String title,
            @Size(max = 1500) String description,
            @Pattern(regexp = "TODO|IN_PROGRESS|DONE|todo|in_progress|done", message = "Некорректный статус") String status,
            @Pattern(regexp = "LOW|NORMAL|HIGH|low|normal|high", message = "Некорректный приоритет") String priority,
            LocalDate dueDate,
            @Size(max = 120) String assignedTo
    ) {}

    public record TaskUpdateRequest(
            @Size(max = 240) String title,
            @Size(max = 1500) String description,
            @Pattern(regexp = "TODO|IN_PROGRESS|DONE|todo|in_progress|done") String status,
            @Pattern(regexp = "LOW|NORMAL|HIGH|low|normal|high") String priority,
            LocalDate dueDate
    ) {}

    public record TaskCommentRequest(@NotBlank @Size(max = 1500) String body) {}

    public record TaskComment(Long id, Long taskId, String username, String body, Instant createdAt) {}

    public record TaskView(
            Long id, String title, String description, String status, String priority,
            LocalDate dueDate, String createdBy, String assignedTo, Instant createdAt, Instant updatedAt
    ) {}
}
