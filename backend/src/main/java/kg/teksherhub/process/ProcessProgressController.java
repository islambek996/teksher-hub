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

    @PutMapping("/{processId}")
    public Map<String, Object> save(@PathVariable String processId,
                                    @RequestBody List<String> completedSteps,
                                    @AuthenticationPrincipal UserAccount user) throws Exception {
        if (processId == null || processId.isBlank() || processId.length() > 80) {
            throw new IllegalArgumentException("Некорректный идентификатор бизнес-процесса.");
        }
        List<String> safeSteps = completedSteps == null ? List.of() : completedSteps.stream()
                .filter(step -> step != null && !step.isBlank() && step.length() <= 120)
                .distinct()
                .limit(100)
                .toList();
        String json = mapper.writeValueAsString(safeSteps);
        jdbc.update("""
                INSERT INTO business_process_progress(username, process_id, completed_steps_json, updated_at)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (username, process_id)
                DO UPDATE SET completed_steps_json = EXCLUDED.completed_steps_json, updated_at = NOW()
                """, user.getUsername(), processId, json);
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'UPDATE_PROGRESS', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Сохранён прогресс выполнения процесса");
        return Map.of("processId", processId, "completedSteps", safeSteps, "saved", true);
    }

    @DeleteMapping("/{processId}")
    public void reset(@PathVariable String processId, @AuthenticationPrincipal UserAccount user) {
        jdbc.update("DELETE FROM business_process_progress WHERE username = ? AND process_id = ?",
                user.getUsername(), processId);
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, 'RESET_PROGRESS', 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, user.getUsername(), processId, processId, "Сброшен прогресс выполнения процесса");
    }
}
