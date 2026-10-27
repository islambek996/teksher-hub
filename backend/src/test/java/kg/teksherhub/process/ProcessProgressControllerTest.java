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
    }

    @Test
    void saveNormalizesCompletedStepsBeforePersisting() throws Exception {
        List<String> submitted = new ArrayList<>();
        submitted.add("step-1");
        submitted.add("step-1");
        submitted.add("  ");
        submitted.add(null);
        submitted.add("x".repeat(121));
        submitted.add("step-2");

        Map<String, Object> result = controller.save("registration", submitted, user);

        assertEquals("registration", result.get("processId"));
        assertEquals(List.of("step-1", "step-2"), result.get("completedSteps"));
        assertEquals(true, result.get("saved"));
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
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
    void saveTreatsNullStepListAsEmpty() throws Exception {
        Map<String, Object> result = controller.save("registration", null, user);

        assertEquals(List.of(), result.get("completedSteps"));
        assertEquals(true, result.get("saved"));
    }
}
