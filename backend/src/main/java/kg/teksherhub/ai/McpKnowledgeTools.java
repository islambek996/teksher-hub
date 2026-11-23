package kg.teksherhub.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.user.UserAccount;
import org.springaicommunity.mcp.annotation.McpTool;
import org.springaicommunity.mcp.annotation.McpToolParam;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class McpKnowledgeTools {
    private final McpKnowledgeService knowledge;
    private final ObjectMapper mapper;

    public McpKnowledgeTools(McpKnowledgeService knowledge, ObjectMapper mapper) {
        this.knowledge = knowledge;
        this.mapper = mapper;
    }

    @McpTool(name = "search_npa",
            description = "Search normative legal acts by free-text query, jurisdiction KG/RU/EAEU, document number and/or exact document date YYYY-MM-DD.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String searchNpa(
            @McpToolParam(description = "Search text, topic or act title", required = true) String query,
            @McpToolParam(description = "Jurisdiction: KG, RU or EAEU", required = false) String jurisdiction,
            @McpToolParam(description = "Act/document number, e.g. 470 or № 515", required = false) String documentNumber,
            @McpToolParam(description = "Exact document date in YYYY-MM-DD format", required = false) String documentDate) {
        return json(knowledge.searchNpa(query, jurisdiction, documentNumber, documentDate, currentRole()));
    }

    @McpTool(name = "search_product_groups",
            description = "Search MZKM product groups, internal Kyrgyz marking groups and related knowledge cards.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String searchProductGroups(
            @McpToolParam(description = "Product group name, product type or a phrase from the group description", required = true) String query) {
        return json(knowledge.searchProductGroups(query, currentRole()));
    }

    @McpTool(name = "check_tnved_code",
            description = "Find an exact 10-digit TN VED EAEU code or a shorter code prefix in saved operator/reference lists. Presence in a list is not a legal determination of mandatory marking.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String checkTnvedCode(
            @McpToolParam(description = "TN VED numeric code, 4 to 10 digits", required = true) String code) {
        return json(knowledge.checkTnvedCode(code, currentRole()));
    }

    @McpTool(name = "get_business_process",
            description = "Read business-process guides, steps and their source links. READER accounts can access published guides only.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String getBusinessProcess(
            @McpToolParam(description = "Process title, category, task or topic", required = true) String query) {
        return json(knowledge.getBusinessProcess(query, currentRole()));
    }

    @McpTool(name = "get_source_monitor_status",
            description = "Read status of official-source monitors: enabled flag, last check, HTTP status, linked materials and open change signals.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String getSourceMonitorStatus(
            @McpToolParam(description = "Optional jurisdiction filter: KG, RU or EAEU", required = false) String jurisdiction) {
        return json(knowledge.getSourceMonitorStatus(jurisdiction, currentRole()));
    }

    @McpTool(name = "list_source_change_events",
            description = "List recent official-source monitoring change events by jurisdiction, including hashes and review state. Only ADMIN/EDITOR may receive saved text snapshots and review notes.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, idempotentHint = true))
    public String listSourceChangeEvents(
            @McpToolParam(description = "Optional jurisdiction filter: KG, RU or EAEU", required = false) String jurisdiction,
            @McpToolParam(description = "Maximum number of events from 1 to 50; default 20", required = false) Integer limit) {
        return json(knowledge.listSourceChangeEvents(jurisdiction, limit, currentRole()));
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Не удалось сериализовать результат MCP-инструмента.", ex);
        }
    }

    private static String currentRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Для MCP требуется авторизованный JWT-сеанс TEKSHER HUB.");
        }
        if (authentication.getPrincipal() instanceof UserAccount account) return account.getRole();
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException("Для MCP не удалось определить роль пользователя."));
    }
}
