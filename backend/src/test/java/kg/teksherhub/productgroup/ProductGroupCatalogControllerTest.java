package kg.teksherhub.productgroup;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProductGroupCatalogControllerTest {
    @Test
    void allowsHttpAndHttpsSourceUrls() {
        ProductGroupCatalogController.CatalogPayload payload = new ProductGroupCatalogController.CatalogPayload(
                List.of("Обувь"),
                List.of(new ProductGroupCatalogController.InternalGroup(
                        "Алкоголь", "Описание", "https://main.teksher.kg/internal-marking.html")),
                Map.of("Обувь", new ProductGroupCatalogController.GroupDetail(
                        "Описание", "http://example.org/reference"))
        );

        assertDoesNotThrow(() -> ProductGroupCatalogController.validateSourceUrls(payload));
    }

    @Test
    void allowsMissingOptionalSourceUrl() {
        ProductGroupCatalogController.CatalogPayload payload = new ProductGroupCatalogController.CatalogPayload(
                List.of("Обувь"),
                List.of(new ProductGroupCatalogController.InternalGroup("Алкоголь", "Описание", "")),
                Map.of("Обувь", new ProductGroupCatalogController.GroupDetail("Описание", null))
        );

        assertDoesNotThrow(() -> ProductGroupCatalogController.validateSourceUrls(payload));
    }

    @Test
    void rejectsJavascriptAndOtherNonHttpSchemes() {
        ProductGroupCatalogController.CatalogPayload payload = new ProductGroupCatalogController.CatalogPayload(
                List.of("Обувь"),
                List.of(),
                Map.of("Обувь", new ProductGroupCatalogController.GroupDetail(
                        "Описание", "javascript:alert(1)"))
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> ProductGroupCatalogController.validateSourceUrls(payload));

        assertTrue(error.getMessage().contains("HTTP или HTTPS"));
    }

    @Test
    void rejectsRelativeAndCredentialBearingUrls() {
        ProductGroupCatalogController.CatalogPayload relative = new ProductGroupCatalogController.CatalogPayload(
                List.of("Обувь"), List.of(),
                Map.of("Обувь", new ProductGroupCatalogController.GroupDetail("Описание", "//example.org/path"))
        );
        ProductGroupCatalogController.CatalogPayload credential = new ProductGroupCatalogController.CatalogPayload(
                List.of("Обувь"), List.of(),
                Map.of("Обувь", new ProductGroupCatalogController.GroupDetail("Описание", "https://user:secret@example.org"))
        );

        assertThrows(IllegalArgumentException.class,
                () -> ProductGroupCatalogController.validateSourceUrls(relative));
        assertThrows(IllegalArgumentException.class,
                () -> ProductGroupCatalogController.validateSourceUrls(credential));
    }
}
