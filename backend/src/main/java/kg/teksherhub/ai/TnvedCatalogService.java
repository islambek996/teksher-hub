package kg.teksherhub.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.zip.GZIPInputStream;

@Service
public class TnvedCatalogService {
    private final List<TnvedEntry> entries;

    public TnvedCatalogService(ObjectMapper mapper) {
        List<TnvedEntry> loaded = new ArrayList<>();
        loaded.addAll(loadResource(mapper, "tnved-catalog/mzkm-internal-base64.txt", "USER_EXCEL"));
        loaded.addAll(loadResource(mapper, "tnved-catalog/bakaleia-base64.txt", "USER_EXCEL_BAKALEIA"));
        // Preserve all 1,072 source rows. A code may legitimately occur in more than one
        // product-group row; collapsing by scope+code would lose its separate classification.
        this.entries = List.copyOf(loaded);
        if (this.entries.size() != 1_072) {
            throw new IllegalStateException("TN VED catalog integrity check failed: expected 1072 source rows, found "
                    + this.entries.size());
        }
    }

    public SearchResult search(String rawCode) {
        String code = rawCode == null ? "" : rawCode.replaceAll("[\\s.-]", "");
        if (code.length() < 4 || code.length() > 10) {
            throw new IllegalArgumentException("Укажите код ТН ВЭД длиной от 4 до 10 цифр.");
        }
        List<TnvedEntry> matches = entries.stream()
                .filter(entry -> entry.code().startsWith(code))
                .toList();
        List<TnvedEntry> visible = matches.stream().limit(50).toList();
        return new SearchResult(code, code.length() == 10 ? "EXACT_10_DIGIT" : "PREFIX_MATCH",
                matches.size(), visible);
    }

    public int totalEntries() {
        return entries.size();
    }

    public long countByScope(String scope) {
        return entries.stream().filter(entry -> scope.equals(entry.scope())).count();
    }

    private static List<TnvedEntry> loadResource(ObjectMapper mapper, String resource, String source) {
        try {
            ClassPathResource file = new ClassPathResource(resource);
            String encoded;
            try (InputStream input = file.getInputStream()) {
                encoded = new String(input.readAllBytes(), StandardCharsets.UTF_8).replaceAll("\\s+", "");
            }
            byte[] compressed = Base64.getDecoder().decode(encoded);
            JsonNode rows;
            try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
                rows = mapper.readTree(gzip);
            }
            if (rows == null || !rows.isArray()) {
                throw new IllegalStateException("TN VED resource is not a JSON array: " + resource);
            }
            List<TnvedEntry> result = new ArrayList<>();
            for (JsonNode row : rows) {
                String code = row.path("c").asText("");
                String name = row.path("n").asText("");
                String group = row.path("g").asText("");
                String scope = row.path("t").asText("");
                String gskpCode = row.path("gc").asText("");
                String gskpName = row.path("gn").asText("");
                if (!code.matches("\\d{10}") || name.isBlank() || group.isBlank()
                        || !List.of("MZKM", "INTERNAL").contains(scope)) {
                    throw new IllegalStateException("Invalid TN VED catalog row in " + resource + ": " + code);
                }
                result.add(new TnvedEntry(code, name, group, scope, gskpCode, gskpName, source));
            }
            return result;
        } catch (IOException | IllegalArgumentException ex) {
            throw new IllegalStateException("Could not load TN VED catalog resource: " + resource, ex);
        }
    }

    public record TnvedEntry(String code, String name, String group, String scope,
                             String gskpCode, String gskpName, String source) {}
    public record SearchResult(String requestedCode, String matchType, int totalMatches,
                               List<TnvedEntry> matches) {}
}
