package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.user.UserAccount;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springaicommunity.mcp.annotation.McpTool;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class McpKnowledgeToolsAuthorizationTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsToolInvocationWithoutAuthenticatedUser() {
        McpKnowledgeTools tools = new McpKnowledgeTools(mock(McpKnowledgeService.class), new ObjectMapper());
        SecurityContextHolder.clearContext();

        assertThrows(AccessDeniedException.class,
                () -> tools.searchNpa("маркировка", "KG", null, null));
    }

    @Test
    void passesAuthenticatedUserRoleToKnowledgeService() throws Exception {
        McpKnowledgeService knowledge = mock(McpKnowledgeService.class);
        when(knowledge.searchNpa("маркировка", "KG", null, null, "READER"))
                .thenReturn(new McpKnowledgeService.ToolResult("search_npa", "Пусто", List.of(), List.of()));
        McpKnowledgeTools tools = new McpKnowledgeTools(knowledge, new ObjectMapper());

        UserAccount reader = new UserAccount();
        reader.setUsername("reader");
        reader.setRole("READER");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(reader, null, reader.getAuthorities()));

        String result = tools.searchNpa("маркировка", "KG", null, null);

        assertTrue(result.contains("search_npa"));
        verify(knowledge).searchNpa("маркировка", "KG", null, null, "READER");
    }

    @Test
    void everyExposedToolDeclaresReadOnlyHints() throws Exception {
        for (Method method : McpKnowledgeTools.class.getDeclaredMethods()) {
            McpTool annotation = method.getAnnotation(McpTool.class);
            if (annotation == null) continue;
            assertTrue(annotation.annotations().readOnlyHint(), method.getName());
            assertFalse(annotation.annotations().destructiveHint(), method.getName());
        }
    }
}
