package kg.teksherhub.process;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/business-process-progress")
public class ProcessProgressController {
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<BusinessProcessStep>> STEP_LIST = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ProcessProgressController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @GetMapping
    public Map<String, List<String>> list(@AuthenticationPrincipal UserAccount user) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        jdbc.query(
                "SELECT process_id, completed_steps_json FROM business_process_progress WHERE username = ?",
                rs -> {
                    try {
                        result.put(rs.getString("process_id"),
                                mapper.readValue(rs.getString("completed_steps_json"), STRING_LIST));
                    } catch (Exception ex) {
                        result.put(rs.getString("process_id"), List.of());
                    }
                },
                user.getUsername());
        return result;
    }

    @PostMapping("/{processId}/start")
    public Map<String, Object> start(@PathVariable String processId,
                                     @AuthenticationPrincipal UserAccount user) {
        validateProcessId(processId);
        String status = getWorkflowStatus(processId);
        ensureExecutable(status, user);
        jdbc.update("""
                INSERT INTO business_process_progress
                    (username, process_id, completed_steps_json, updated_at, execution_status, started_at, completed_at)
                VALUES (?, ?, '[]', NOW(), 'IN_PROGRESS', NOW(), NULL)
                ON CONFLICT (username, process_id)
                DO UPDATE SET completed_steps_json = '[]', updated_at = NOW(),
                              execution_status = 'IN_PROGRESS', started_at = NOW(), completed_at = NULL
                """, user.getUsername(), processId);
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'START_EXECUTION', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Начато прохождение бизнес-процесса");
        return Map.of("processId", processId, "started", true);
    }

    @PostMapping("/{processId}/complete")
    public Map<String, Object> complete(@PathVariable String processId,
                                        @AuthenticationPrincipal UserAccount user) {
        validateProcessId(processId);
        String status = getWorkflowStatus(processId);
        ensureExecutable(status, user);
        int updated = jdbc.update("""
                UPDATE business_process_progress
                SET execution_status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
                WHERE username = ? AND process_id = ?
                """, user.getUsername(), processId);
        if (updated == 0) {
            jdbc.update("""
                    INSERT INTO business_process_progress
                        (username, process_id, completed_steps_json, updated_at, execution_status, started_at, completed_at)
                    VALUES (?, ?, '[]', NOW(), 'COMPLETED', NOW(), NOW())
                    """, user.getUsername(), processId);
        }
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'COMPLETE_EXECUTION', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Завершено прохождение бизнес-процесса");
        return Map.of("processId", processId, "completed", true);
    }

    private void validateProcessId(String processId) {
        if (processId == null || processId.isBlank() || processId.length() > 80) {
            throw new IllegalArgumentException("Некорректный идентификатор бизнес-процесса.");
        }
    }

    private String getWorkflowStatus(String processId) {
        try {
            return jdbc.queryForObject(
                    "SELECT workflow_status FROM business_process_guides WHERE id = ?",
                    String.class, processId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("Бизнес-процесс не найден.");
        }
    }

    private void ensureExecutable(String status, UserAccount user) {
        if (!"ADMIN".equals(user.getRole()) && !"EDITOR".equals(user.getRole())
                && !"PUBLISHED".equals(status)) {
            throw new IllegalArgumentException("Этот процесс ещё не опубликован.");
        }
    }

    @PutMapping("/{processId}")
    public Map<String, Object> save(@PathVariable String processId,
                                    @RequestBody List<String> completedSteps,
                                    @AuthenticationPrincipal UserAccount user) throws Exception {
        validateProcessId(processId);
        final String workflowStatus;
        try {
            workflowStatus = jdbc.queryForObject(
                    "SELECT workflow_status FROM business_process_guides WHERE id = ?",
                    String.class, processId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("Бизнес-процесс не найден.");
        }
        if (!"ADMIN".equals(user.getRole()) && !"EDITOR".equals(user.getRole())
                && !"PUBLISHED".equals(workflowStatus)) {
            throw new IllegalArgumentException("Этот процесс ещё не опубликован.");
        }
        final String stepsJson = jdbc.queryForObject(
                "SELECT steps_json FROM business_process_guides WHERE id = ?",
                String.class, processId);
        if (stepsJson == null || stepsJson.isBlank()) {
            throw new IllegalArgumentException("У бизнес-процесса нет доступных шагов.");
        }
        List<BusinessProcessStep> processSteps = mapper.readValue(stepsJson, STEP_LIST);
        int stepCount = processSteps == null ? 0 : processSteps.size();
        List<String> safeSteps = completedSteps == null ? List.of() : completedSteps.stream()
                .filter(step -> step != null && step.matches("\\d{1,3}"))
                .map(Integer::parseInt)
                .filter(index -> index >= 0 && index < stepCount)
                .distinct()
                .sorted()
                .map(String::valueOf)
                .toList();
        String json = mapper.writeValueAsString(safeSteps);
        jdbc.update("""
                INSERT INTO business_process_progress(username, process_id, completed_steps_json, updated_at)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (username, process_id)
                DO UPDATE SET completed_steps_json = EXCLUDED.completed_steps_json, updated_at = NOW(),
                              execution_status = 'IN_PROGRESS', completed_at = NULL
                """, user.getUsername(), processId, json);
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'UPDATE_PROGRESS', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Сохранён прогресс выполнения процесса");
        return Map.of("processId", processId, "completedSteps", safeSteps, "saved", true);
    }

    @DeleteMapping("/{processId}")
    public void reset(@PathVariable String processId, @AuthenticationPrincipal UserAccount user) {
        if (processId == null || processId.isBlank() || processId.length() > 80) {
            throw new IllegalArgumentException("Некорректный идентификатор бизнес-процесса.");
        }
        jdbc.update("DELETE FROM business_process_progress WHERE username = ? AND process_id = ?",
                user.getUsername(), processId);
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'RESET_PROGRESS', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Сброшен прогресс выполнения процесса");
    }
}
