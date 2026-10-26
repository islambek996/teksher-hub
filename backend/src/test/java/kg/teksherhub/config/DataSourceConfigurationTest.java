package kg.teksherhub.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DataSourceConfigurationTest {

    @Test
    void refusesToCreateDatasourceWithoutAnExplicitPassword() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("DATABASE_URL", "jdbc:postgresql://localhost:5432/teksher_hub")
                .withProperty("DATABASE_USERNAME", "teksher");

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> new DataSourceConfiguration().dataSource(environment));

        assertEquals("DATABASE_PASSWORD must be explicitly configured; no default password is allowed",
                exception.getMessage());
    }
}
