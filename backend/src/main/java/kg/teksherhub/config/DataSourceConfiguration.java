package kg.teksherhub.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Configuration
public class DataSourceConfiguration {
    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        String rawUrl = firstNonBlank(
                env.getProperty("SPRING_DATASOURCE_URL"),
                env.getProperty("DATABASE_URL"),
                env.getProperty("spring.datasource.url"),
                "jdbc:postgresql://localhost:5432/teksher_hub");
        String username = firstNonBlank(
                env.getProperty("SPRING_DATASOURCE_USERNAME"),
                env.getProperty("DATABASE_USERNAME"),
                env.getProperty("spring.datasource.username"),
                "teksher");
        String password = firstNonBlank(
                env.getProperty("SPRING_DATASOURCE_PASSWORD"),
                env.getProperty("DATABASE_PASSWORD"),
                env.getProperty("spring.datasource.password"),
                "teksher-dev-password");

        ParsedDatabaseUrl parsed = normalizeUrl(rawUrl, username, password);
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(parsed.jdbcUrl());
        config.setUsername(parsed.username());
        config.setPassword(parsed.password());
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(10000);
        config.setPoolName("teksher-hub-pool");
        return new HikariDataSource(config);
    }

    private static ParsedDatabaseUrl normalizeUrl(String value, String username, String password) {
        String raw = value.trim();
        if (raw.startsWith("jdbc:postgresql:")) return new ParsedDatabaseUrl(raw, username, password);
        if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) {
            throw new IllegalStateException("DATABASE_URL must be a JDBC PostgreSQL URL or a PostgreSQL connection URI");
        }
        try {
            URI uri = URI.create(raw);
            String host = uri.getHost();
            String path = uri.getPath();
            if (host == null || path == null || path.length() < 2) throw new IllegalArgumentException();
            String jdbc = "jdbc:postgresql://" + host + ":" + (uri.getPort() == -1 ? 5432 : uri.getPort()) + path;
            if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) jdbc += "?" + uri.getRawQuery();
            String actualUser = username;
            String actualPassword = password;
            String info = uri.getRawUserInfo();
            if (info != null) {
                String[] pieces = info.split(":", 2);
                if (pieces.length > 0 && !pieces[0].isBlank()) actualUser = decode(pieces[0]);
                if (pieces.length > 1 && !pieces[1].isBlank()) actualPassword = decode(pieces[1]);
            }
            return new ParsedDatabaseUrl(jdbc, actualUser, actualPassword);
        } catch (RuntimeException ex) {
            throw new IllegalStateException("Could not parse DATABASE_URL as a PostgreSQL connection URI", ex);
        }
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "";
    }

    private record ParsedDatabaseUrl(String jdbcUrl, String username, String password) {}
}
