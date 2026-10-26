package kg.teksherhub.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OfficialWebSearchService {
    private static final Logger log = LoggerFactory.getLogger(OfficialWebSearchService.class);
    private static final URI SEARCH_URI = URI.create("https://html.duckduckgo.com/html/");
    private static final Pattern RESULT_LINK = Pattern.compile(
            "(?is)<a[^>]*class=[\"'][^\"']*result__a[^\"']*[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>");
    private static final Pattern RESULT_SNIPPET = Pattern.compile(
            "(?is)<(?:a|div|td)[^>]*class=[\"'][^\"']*result__snippet[^\"']*[\"'][^>]*>(.*?)</(?:a|div|td)>");
    private static final Pattern TAGS = Pattern.compile("(?is)<[^>]+>");
    private static final Pattern SPACE = Pattern.compile("\\s+");
    private static final List<String> OFFICIAL_HOSTS = List.of(
            "gov.kg", "minjust.gov.kg", "cbd.minjust.gov.kg",
            "eec.eaeunion.org", "docs.eaeunion.org", "publication.pravo.gov.ru",
            "pravo.gov.ru", "government.ru", "честныйзнак.рф", "xn--80ajghhoc2aj1c8b.xn--p1ai"
    );

    private final HttpClient httpClient;
    private final boolean enabled;

    public OfficialWebSearchService(@Value("${app.ai.web-search-enabled:true}") boolean enabled) {
        this.enabled = enabled;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public List<WebSource> search(String question, List<String> terms) {
        if (!enabled || question == null || question.isBlank()) return List.of();
        String query = question.trim();
        if (query.length() > 220) query = query.substring(0, 220);
        // Limit the search to known official domains; results outside this allowlist are discarded as well.
        query += " (site:gov.kg OR site:minjust.gov.kg OR site:cbd.minjust.gov.kg"
                + " OR site:eec.eaeunion.org OR site:docs.eaeunion.org"
                + " OR site:publication.pravo.gov.ru OR site:pravo.gov.ru"
                + " OR site:government.ru OR site:честныйзнак.рф)";
        try {
            URI uri = URI.create(SEARCH_URI + "?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8));
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(12))
                    .header("User-Agent", "Mozilla/5.0 (compatible; TEKSHER-HUB/1.0)")
                    .header("Accept", "text/html")
                    .GET().build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.info("Official web search returned HTTP {}", response.statusCode());
                return List.of();
            }
            String html = response.body();
            List<String> snippets = new ArrayList<>();
            Matcher snippetMatcher = RESULT_SNIPPET.matcher(html);
            while (snippetMatcher.find()) snippets.add(cleanHtml(snippetMatcher.group(1)));

            Map<String, WebSource> unique = new LinkedHashMap<>();
            Matcher matcher = RESULT_LINK.matcher(html);
            int index = 0;
            while (matcher.find() && unique.size() < 4) {
                String url = unwrapUrl(decodeHtml(matcher.group(1)));
                String title = cleanHtml(matcher.group(2));
                String snippet = index < snippets.size() ? snippets.get(index) : "";
                index++;
                if (!isOfficialUrl(url) || title.isBlank()) continue;
                unique.putIfAbsent(url, new WebSource(title, url, snippet, ""));
            }
            return unique.values().stream().limit(4).toList();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (IOException | IllegalArgumentException ex) {
            log.info("Official web search unavailable; continuing with TEKSHER HUB knowledge base");
            return List.of();
        } catch (RuntimeException ex) {
            log.info("Official web search failed; continuing with TEKSHER HUB knowledge base");
            return List.of();
        }
    }

    private static String unwrapUrl(String value) {
        String url = value == null ? "" : value.trim();
        if (url.startsWith("//")) url = "https:" + url;
        try {
            URI uri = URI.create(url);
            String target = uri.getQuery();
            if (uri.getHost() != null && uri.getHost().toLowerCase(Locale.ROOT).contains("duckduckgo.com")
                    && target != null) {
                for (String part : target.split("&")) {
                    int equals = part.indexOf('=');
                    if (equals > 0 && part.substring(0, equals).equals("uddg")) {
                        return URLDecoder.decode(part.substring(equals + 1), StandardCharsets.UTF_8);
                    }
                }
            }
        } catch (IllegalArgumentException ignored) {
            return "";
        }
        return url;
    }

    private static boolean isOfficialUrl(String value) {
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null) return false;
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            return OFFICIAL_HOSTS.stream().anyMatch(allowed ->
                    host.equals(allowed) || host.endsWith("." + allowed));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static String cleanHtml(String html) {
        return SPACE.matcher(decodeHtml(TAGS.matcher(html == null ? "" : html).replaceAll(" ")))
                .replaceAll(" ").trim();
    }

    private static String decodeHtml(String value) {
        return value == null ? "" : value
                .replace("&amp;", "&").replace("&#x27;", "'").replace("&#39;", "'")
                .replace("&quot;", "\"").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&nbsp;", " ").replace("&#x2F;", "/");
    }

    public record WebSource(String title, String url, String snippet, String content) {}
}
