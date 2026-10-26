package kg.teksherhub.ai;

import java.net.http.HttpHeaders;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.OptionalLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Converts Groq rate-limit response headers into a safe, actionable message for the UI. */
final class GroqRateLimitDetails {
    private static final Pattern RESET_PART = Pattern.compile("(\\d+(?:\\.\\d+)?)(ms|s|m|h)", Pattern.CASE_INSENSITIVE);
    private static final Pattern LIMIT_KIND = Pattern.compile(
            "(?i)(tokens?\\s+per\\s+(?:minute|day)|requests?\\s+per\\s+(?:minute|day)|TPM|RPM|TPD|RPD)");

    private GroqRateLimitDetails() {}

    static String describe(HttpHeaders headers, String body) {
        String kind = detectLimitKind(headers, body);
        String tokenRemaining = header(headers, "x-ratelimit-remaining-tokens");
        String tokenLimit = header(headers, "x-ratelimit-limit-tokens");
        String requestRemaining = header(headers, "x-ratelimit-remaining-requests");
        String requestLimit = header(headers, "x-ratelimit-limit-requests");

        StringBuilder message = new StringBuilder("GroqCloud временно ограничил запросы");
        if (!kind.isBlank()) message.append(" (").append(kind).append(")");
        message.append(".");

        String tokenStats = statistic("Остаток токенов", tokenRemaining, tokenLimit);
        String requestStats = statistic("Остаток запросов", requestRemaining, requestLimit);
        if (!tokenStats.isBlank() || !requestStats.isBlank()) {
            message.append(" ");
            if (!tokenStats.isBlank()) message.append(tokenStats);
            if (!tokenStats.isBlank() && !requestStats.isBlank()) message.append("; ");
            if (!requestStats.isBlank()) message.append(requestStats);
            message.append(".");
        }

        OptionalLong retry = retryAfterSeconds(headers);
        if (retry.isEmpty()) retry = resetSeconds(headers, kind);
        if (retry.isPresent()) {
            message.append(" Повторите попытку через ").append(formatDelay(retry.getAsLong())).append(".");
        } else {
            message.append(" Groq не сообщил срок восстановления в заголовках; проверьте лимиты и биллинг API и попробуйте позже.");
        }
        return message.toString();
    }

    private static String detectLimitKind(HttpHeaders headers, String body) {
        String searchable = body == null ? "" : body;
        Matcher matcher = LIMIT_KIND.matcher(searchable);
        if (matcher.find()) return normalizeKind(matcher.group());

        String tokenRemaining = header(headers, "x-ratelimit-remaining-tokens");
        String requestRemaining = header(headers, "x-ratelimit-remaining-requests");
        if ("0".equals(tokenRemaining) && !"0".equals(requestRemaining)) return "лимит токенов";
        if ("0".equals(requestRemaining) && !"0".equals(tokenRemaining)) return "лимит запросов";
        if ("0".equals(tokenRemaining)) return "лимит токенов";
        if ("0".equals(requestRemaining)) return "лимит запросов";
        return "";
    }

    private static String normalizeKind(String raw) {
        String value = raw.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        return switch (value) {
            case "tpm", "tokens per minute", "token per minute" -> "лимит токенов в минуту (TPM)";
            case "rpm", "requests per minute", "request per minute" -> "лимит запросов в минуту (RPM)";
            case "tpd", "tokens per day", "token per day" -> "дневной лимит токенов (TPD)";
            case "rpd", "requests per day", "request per day" -> "дневной лимит запросов (RPD)";
            default -> value.contains("token") ? "лимит токенов" : "лимит запросов";
        };
    }

    private static String statistic(String label, String remaining, String limit) {
        if (remaining.isBlank() && limit.isBlank()) return "";
        if (!remaining.isBlank() && !limit.isBlank()) return label + ": " + remaining + " из " + limit;
        return label + ": " + (!remaining.isBlank() ? remaining : "неизвестно")
                + (limit.isBlank() ? "" : " из " + limit);
    }

    private static OptionalLong retryAfterSeconds(HttpHeaders headers) {
        String value = header(headers, "retry-after");
        if (value.isBlank()) return OptionalLong.empty();
        try {
            double seconds = Double.parseDouble(value);
            if (seconds >= 0 && Double.isFinite(seconds)) return OptionalLong.of((long) Math.ceil(seconds));
        } catch (NumberFormatException ignored) {
            // Retry-After may instead contain an HTTP date.
        }
        try {
            Instant target = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
            return OptionalLong.of(Math.max(0, Duration.between(Instant.now(), target).getSeconds()));
        } catch (DateTimeParseException ignored) {
            return OptionalLong.empty();
        }
    }

    private static OptionalLong resetSeconds(HttpHeaders headers, String kind) {
        boolean tokenLimit = kind.contains("токен") || kind.contains("(TPM)") || kind.contains("(TPD)");
        boolean requestLimit = kind.contains("запрос") || kind.contains("(RPM)") || kind.contains("(RPD)");
        if (tokenLimit) return parseReset(header(headers, "x-ratelimit-reset-tokens"));
        if (requestLimit) return parseReset(header(headers, "x-ratelimit-reset-requests"));

        // If Groq did not identify the exhausted quota, do not guess which reset timer applies.
        OptionalLong tokens = parseReset(header(headers, "x-ratelimit-reset-tokens"));
        OptionalLong requests = parseReset(header(headers, "x-ratelimit-reset-requests"));
        if (tokens.isPresent() && requests.isPresent()) {
            return tokens.getAsLong() == requests.getAsLong() ? tokens : OptionalLong.empty();
        }
        return tokens.isPresent() ? tokens : requests;
    }

    private static OptionalLong parseReset(String value) {
        if (value.isBlank()) return OptionalLong.empty();
        try {
            double seconds = Double.parseDouble(value);
            if (seconds >= 0 && Double.isFinite(seconds)) return OptionalLong.of((long) Math.ceil(seconds));
        } catch (NumberFormatException ignored) {
            // Groq reset values are commonly duration strings such as "6s" or "1m30s".
        }
        Matcher matcher = RESET_PART.matcher(value);
        double total = 0;
        int end = 0;
        boolean found = false;
        while (matcher.find()) {
            if (!value.substring(end, matcher.start()).isBlank()) return OptionalLong.empty();
            double amount = Double.parseDouble(matcher.group(1));
            String unit = matcher.group(2).toLowerCase(Locale.ROOT);
            total += amount * switch (unit) {
                case "ms" -> 0.001;
                case "s" -> 1;
                case "m" -> 60;
                case "h" -> 3600;
                default -> 0;
            };
            end = matcher.end();
            found = true;
        }
        if (!found || !value.substring(end).isBlank() || !Double.isFinite(total) || total < 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of((long) Math.ceil(total));
    }

    private static String formatDelay(long seconds) {
        if (seconds < 60) return seconds + " сек.";
        long minutes = seconds / 60;
        long remainder = seconds % 60;
        return remainder == 0 ? minutes + " мин." : minutes + " мин. " + remainder + " сек.";
    }

    private static String header(HttpHeaders headers, String name) {
        if (headers == null) return "";
        return headers.firstValue(name).orElse("").trim();
    }
}
