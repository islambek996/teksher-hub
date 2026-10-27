package kg.teksherhub.process;

import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.user.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ProcessProgressControllerTest {
    private JdbcTemplate jdbc;
    private ProcessProgressController controller;
    private UserAccount user;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        controller = new ProcessProgressController(jdbc, new ObjectMapper());
        user = new UserAccount();
        user.setUsername("tester");
        user.setRole("ADMIN");
    }

    @Test
    void startCreatesAnInProgressExecutionAndWritesAuditLog() {
        when(jdbc.queryForObject(contains("SELECT workflow_status"), eq(String.class), eq("registration")))
                .thenReturn("PUBLISHED");

        Map<String, Object> result = controller.start("registration", user);

        assertEquals(true, result.get("started"));
        verify(jdbc).update(contains("INSERT INTO business_process_progress"),
                eq("tester"), eq("registration"));
        verify(jdbc).update(contains("INSERT INTO audit_log"), eq("tester"), eq("registration"),
                eq("registration"), eq("Начато прохождение бизнес-процесса"));
    }

    @Test
    void completeWritesCompletionStateAndAuditLog() {
        when(jdbc.queryForObject(contains("SELECT workflow_status"), eq(String.class), eq("registration")))
                .thenReturn("PUBLISHED");

        Map<String, Object> result = controller.complete("registration", user);

        assertEquals(true, result.get("completed"));
        verify(jdbc).update(contains("SET execution_status = 'COMPLETED'"),
                eq("tester"), eq("registration"));
        verify(jdbc).update(contains("INSERT INTO audit_log"), eq("tester"), eq("registration"),
                eq("registration"), eq("Завершено прохождение бизнес-процесса"));
    }

    @Test
    void saveNormalizesCompletedStepsBeforePersisting() throws Exception {
        List<String> submitted = new ArrayList<>();
        submitted.add("1");
        submitted.add("1");
        submitted.add("  ");
        submitted.add(null);
        submitted.add("x".repeat(121));
        submitted.add("0");
        submitted.add("step-2");

        when(jdbc.queryForObject(anyString(), eq(String.class), eq("registration")))
                .thenReturn("[{\"title\":\"First\",\"detail\":\"Details\"},{\"title\":\"Second\",\"detail\":\"Details\"}]");
        Map<String, Object> result = controller.save("registration", submitted, user);

        assertEquals("registration", result.get("processId"));
        assertEquals(List.of("0", "1"), result.get("completedSteps"));
        assertEquals(true, result.get("saved"));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }


    @Test
    void saveDropsProgressIndexesThatDoNotExistInTheProcess() throws Exception {
        when(jdbc.queryForObject(anyString(), eq(String.class), eq("registration")))
                .thenReturn("[{\"title\":\"Only step\",\"detail\":\"Details\"}]");

        Map<String, Object> result = controller.save("registration", List.of("0", "1", "-1", "not-a-number"), user);

        assertEquals(List.of("0"), result.get("completedSteps"));
    }

    @Test
    void saveRejectsUnknownProcess() {
        when(jdbc.queryForObject(anyString(), eq(String.class), eq("missing"))).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> controller.save("missing", List.of("0"), user));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void saveRejectsBlankProcessId() {
        assertThrows(IllegalArgumentException.class,
                () -> controller.save("  ", List.of("step-1"), user));
        verifyNoInteractions(jdbc);
    }

    @Test
    void saveRejectsOverlongProcessId() {
        assertThrows(IllegalArgumentException.class,
                () -> controller.save("p".repeat(81), List.of("step-1"), user));
        verifyNoInteractions(jdbc);
    }

    @Test
    void resetRejectsBlankProcessIdWithoutDatabaseAccess() {
        assertThrows(IllegalArgumentException.class, () -> controller.reset("  ", user));
        verifyNoInteractions(jdbc);
    }

    @Test
    void resetRejectsOverlongProcessIdWithoutDatabaseAccess() {
        assertThrows(IllegalArgumentException.class, () -> controller.reset("p".repeat(81), user));
        verifyNoInteractions(jdbc);
    }

    @Test
    void resetDeletesOnlyCurrentUsersProgress() {
        controller.reset("registration", user);

        verify(jdbc).update(contains("DELETE FROM business_process_progress WHERE username = ? AND process_id = ?"),
                eq("tester"), eq("registration"));
        verify(jdbc).update(contains("INSERT INTO audit_log"), eq("tester"), eq("registration"),
                eq("registration"), eq("Сброшен прогресс выполнения процесса"));
    }

    @Test
    void saveTreatsNullStepListAsEmpty() throws Exception {
        when(jdbc.queryForObject(anyString(), eq(String.class), eq("registration")))
                .thenReturn("[{\"title\":\"First\",\"detail\":\"Details\"}]");
        Map<String, Object> result = controller.save("registration", null, user);

        assertEquals(List.of(), result.get("completedSteps"));
        assertEquals(true, result.get("saved"));
    }
}
