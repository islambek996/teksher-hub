package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class McpAiToolCallingService {
    private static final Logger log = LoggerFactory.getLogger(McpAiToolCallingService.class);
    private static final URI CHAT_COMPLETIONS_URI = URI.create("https://api.groq.com/openai/v1/chat/completions");
    private static final Pattern TOOL_TRIGGER = Pattern.compile(
            "(?Uiu)(нпа|норматив|постановлен|приказ|закон"
                    + "|тн\\s*вед|тнвед"
                    + "|коды?\\s*(?:тн\\s*вед)?\\s*[:№-]?\\s*\\d{4,10}"
                    + "|код\\s+товар|товарн\\w*\\s+групп"
                    + "|бизнес[- ]процесс|процесс|инструкц"
                    + "|регистрац|созда\\w*\\s+карточк|карточк\\w*\\s+товар"
                    + "|заказ\\w*\\s+код|печать|нанесен|отгрузк|перемещен|ввод\\w*\\s+в\\s+оборот"
                    + "|игрушк|космет|обув|бакал|алкогол|табак|корм|парфюмер|моторн\\w*\\s+масл|фотокамер|молочн\\w*\\s+продукт"
                    + "|мониторинг|источник|изменени\\w*\\s+источник|событи\\w*\\s+монитор)");

    private final McpKnowledgeService knowledge;
    private final ObjectMapper mapper;
    private final List<String> apiKeys;
    private final String model;
    private final boolean enabled;
    private final HttpClient httpClient;

    public McpAiToolCallingService(
            McpKnowledgeService knowledge,
            ObjectMapper mapper,
            @Value("${app.ai.groq-api-key:}") String apiKey,
            @Value("${app.ai.groq-api-keys:}") String apiKeysConfig,
            @Value("${app.ai.groq-model:openai/gpt-oss-20b}") String model,
            @Value("${app.ai.mcp-tool-calling-enabled:true}") boolean enabled) {
        this.knowledge = knowledge;
        this.mapper = mapper;
        LinkedHashSet<String> keys = new LinkedHashSet<>();
        if (apiKeysConfig != null) Arrays.stream(apiKeysConfig.split("[,;\\s]+"))
                .map(String::trim).filter(value -> !value.isBlank()).forEach(keys::add);
        if (apiKey != null) Arrays.stream(apiKey.split("[,;\\s]+"))
                .map(String::trim).filter(value -> !value.isBlank()).forEach(keys::add);
        this.apiKeys = List.copyOf(keys);
        this.model = model == null || model.isBlank() ? "openai/gpt-oss-20b" : model.trim();
        this.enabled = enabled;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public List<McpKnowledgeService.ToolResult> collect(String question, String role) {
        if (!enabled || apiKeys.isEmpty() || !isRelevantQuestion(question)) return List.of();
        for (int keyIndex = 0; keyIndex < apiKeys.size(); keyIndex++) {
            try {
                JsonNode response = requestToolSelection(question, apiKeys.get(keyIndex));
                JsonNode calls = response.path("choices").path(0).path("message").path("tool_calls");
                if (!calls.isArray() || calls.isEmpty()) return List.of();
                List<McpKnowledgeService.ToolResult> results = new ArrayList<>();
                for (JsonNode call : calls) {
                    if (results.size() >= 6) break;
                    String name = call.path("function").path("name").asText("");
                    if (name.isBlank()) continue;
                    JsonNode arguments;
                    try {
                        arguments = mapper.readTree(call.path("function").path("arguments").asText("{}"));
                    } catch (Exception ex) {
                        log.warn("Groq tool-calling model returned invalid arguments for {}", name);
                        continue;
                    }
                    try {
                        McpKnowledgeService.ToolResult result = dispatch(name, arguments, role);
                        if (result != null) results.add(result);
                    } catch (IllegalArgumentException ex) {
                        log.info("MCP function {} returned a validation error: {}", name, ex.getMessage());
                    } catch (RuntimeException ex) {
                        log.warn("MCP function {} failed; continuing with other selected tools", name, ex);
                    }
                }
                return List.copyOf(results);
            } catch (ProviderStatusException ex) {
                if (ex.keySpecific() && keyIndex + 1 < apiKeys.size()) {
                    log.warn("Groq tool-selection key {} returned HTTP {}; trying next key",
                            keyIndex + 1, ex.status());
                    continue;
                }
                log.warn("MCP tool selection is unavailable (HTTP {}); ordinary retrieval will continue", ex.status());
                return List.of();
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("MCP tool selection was interrupted; ordinary retrieval will continue");
                return List.of();
            } catch (IOException | RuntimeException ex) {
                log.warn("MCP tool selection failed; ordinary retrieval will continue", ex);
                if (keyIndex + 1 >= apiKeys.size()) return List.of();
            }
        }
        return List.of();
    }

    static boolean isRelevantQuestion(String question) {
        if (question == null || question.isBlank()) return false;
        String normalized = question.toLowerCase(Locale.ROOT).replace('ё', 'е');
        // Some common marking abbreviations are written with variable spacing and punctuation.
        if (normalized.contains("тн") && normalized.contains("вед")) return true;
        return TOOL_TRIGGER.matcher(normalized).find();
    }

    private JsonNode requestToolSelection(String question, String apiKey)
            throws IOException, InterruptedException {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("model", model);
        payload.put("max_completion_tokens", 700);
        payload.put("tool_choice", "auto");
        // openai/gpt-oss-20b supports tool calls but not parallel tool calls.
        payload.put("parallel_tool_calls", false);
        ArrayNode messages = payload.putArray("messages");
        messages.addObject().put("role", "system").put("content", """
                Ты – диспетчер read-only инструментов TEKSHER HUB. Выбирай только инструменты, необходимые для ответа.
                Не отвечай на вопрос и не делай юридических выводов сам: верни вызовы функций. Можно вызвать несколько инструментов, если вопрос требует нескольких проверок.
                search_npa используй для нормативных актов, реквизитов, номера, даты и юрисдикции.
                search_product_groups используй для товарных групп и описаний категорий.
                check_tnved_code используй, когда вопрос содержит конкретный код ТН ВЭД.
                get_business_process используй для пошаговых процедур и внутренних инструкций.
                get_source_monitor_status используй для текущего состояния мониторинга.
                list_source_change_events используй для истории изменений источников.
                Не вызывай инструменты, не относящиеся к вопросу. Все действия только для чтения.
                """);
        messages.addObject().put("role", "user").put("content", question);
        payload.set("tools", toolSchemas());

        HttpRequest request = HttpRequest.newBuilder(CHAT_COMPLETIONS_URI)
                .timeout(Duration.ofSeconds(25))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            int status = response.statusCode();
            throw new ProviderStatusException(status, status == 401 || status == 403 || status == 429);
        }
        return mapper.readTree(response.body());
    }

    private McpKnowledgeService.ToolResult dispatch(String name, JsonNode args, String role) {
        return switch (name) {
            case "search_npa" -> knowledge.searchNpa(
                    args.path("query").asText(""),
                    args.path("jurisdiction").asText(""),
                    args.path("document_number").asText(""),
                    args.path("document_date").asText(""), role);
            case "search_product_groups" -> knowledge.searchProductGroups(
                    args.path("query").asText(""), role);
            case "check_tnved_code" -> knowledge.checkTnvedCode(
                    args.path("code").asText(""), role);
            case "get_business_process" -> knowledge.getBusinessProcess(
                    args.path("query").asText(""), role);
            case "get_source_monitor_status" -> knowledge.getSourceMonitorStatus(
                    args.path("jurisdiction").asText(""), role);
            case "list_source_change_events" -> knowledge.listSourceChangeEvents(
                    args.path("jurisdiction").asText(""),
                    args.hasNonNull("limit") ? args.path("limit").asInt(20) : 20, role);
            default -> {
                log.warn("Ignored an unknown MCP tool requested by the model: {}", name);
                yield null;
            }
        };
    }

    private ArrayNode toolSchemas() {
        ArrayNode tools = mapper.createArrayNode();
        tools.add(function("search_npa", "Find NPA by text, jurisdiction, number and date",
                List.of(
                        property("query", "string", "Search phrase or act title", null),
                        property("jurisdiction", "string", "KG, RU or EAEU", new String[]{"KG","RU","EAEU"}),
                        property("document_number", "string", "Act/document number", null),
                        property("document_date", "string", "Exact date YYYY-MM-DD", null)), "query"));
        tools.add(function("search_product_groups", "Find saved product groups and related knowledge cards",
                List.of(property("query", "string", "Product group name or description", null)), "query"));
        tools.add(function("check_tnved_code", "Check a TN VED code in saved operator/reference lists",
                List.of(property("code", "string", "4 to 10 digit TN VED code", null)), "code"));
        tools.add(function("get_business_process", "Read matching process guides and source links",
                List.of(property("query", "string", "Process title or topic", null)), "query"));
        tools.add(function("get_source_monitor_status", "Read official source monitor statuses",
                List.of(property("jurisdiction", "string", "Optional KG, RU or EAEU filter", new String[]{"KG","RU","EAEU"}))));
        tools.add(function("list_source_change_events", "Read recent source change events and review state",
                List.of(
                        property("jurisdiction", "string", "Optional KG, RU or EAEU filter", new String[]{"KG","RU","EAEU"}),
                        property("limit", "integer", "Number of results, from 1 to 50", null))));
        return tools;
    }

    private ObjectNode function(String name, String description, List<ObjectNode> properties, String... required) {
        ObjectNode tool = mapper.createObjectNode();
        tool.put("type", "function");
        ObjectNode function = tool.putObject("function");
        function.put("name", name);
        function.put("description", description);
        ObjectNode parameters = function.putObject("parameters");
        parameters.put("type", "object");
        ObjectNode propertyMap = parameters.putObject("properties");
        properties.forEach(item -> propertyMap.set(item.path("name").asText(), item.path("schema")));
        ArrayNode requiredArray = parameters.putArray("required");
        Arrays.stream(required).forEach(requiredArray::add);
        parameters.put("additionalProperties", false);
        return tool;
    }

    private ObjectNode property(String name, String type, String description, String[] enumeration) {
        ObjectNode property = mapper.createObjectNode();
        property.put("name", name);
        ObjectNode schema = property.putObject("schema");
        schema.put("type", type);
        schema.put("description", description);
        if (enumeration != null) {
            ArrayNode values = schema.putArray("enum");
            Arrays.stream(enumeration).forEach(values::add);
        }
        return property;
    }

    static final class ProviderStatusException extends RuntimeException {
        private final int status;
        private final boolean keySpecific;
        ProviderStatusException(int status, boolean keySpecific) {
            super("Groq tool-call request failed with HTTP " + status);
            this.status = status;
            this.keySpecific = keySpecific;
        }
        int status() { return status; }
        boolean keySpecific() { return keySpecific; }
    }
}
