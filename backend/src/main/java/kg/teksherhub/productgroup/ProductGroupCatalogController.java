package kg.teksherhub.productgroup;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import kg.teksherhub.user.UserAccount;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/product-groups")
public class ProductGroupCatalogController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ProductGroupCatalogController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @GetMapping
    public CatalogResponse get() {
        List<CatalogResponse> rows = jdbc.query(
                "SELECT payload_json, updated_by, updated_at FROM product_group_catalog WHERE id = 1",
                (rs, row) -> {
                    try {
                        CatalogPayload payload = mapper.readValue(rs.getString("payload_json"), CatalogPayload.class);
                        return new CatalogResponse(payload, rs.getString("updated_by"), rs.getTimestamp("updated_at").toInstant());
                    } catch (JsonProcessingException ex) {
                        throw new IllegalStateException("Не удалось прочитать каталог товарных групп", ex);
                    }
                });
        return rows.isEmpty() ? new CatalogResponse(null, null, null) : rows.get(0);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','EDITOR')")
    public CatalogResponse save(@Valid @RequestBody CatalogPayload payload,
                                @AuthenticationPrincipal UserAccount user) {
        validateSourceUrls(payload);
        try {
            String json = mapper.writeValueAsString(payload);
            jdbc.update("""
                INSERT INTO product_group_catalog(id, payload_json, updated_by, updated_at)
                VALUES (1, ?, ?, NOW())
                ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json,
                    updated_by = EXCLUDED.updated_by, updated_at = NOW()
                """, json, user.getUsername());
            return get();
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Не удалось сохранить каталог товарных групп", ex);
        }
    }

    static void validateSourceUrls(CatalogPayload payload) {
        if (payload == null) {
            throw new IllegalArgumentException("Не передан каталог товарных групп.");
        }
        if (payload.internalGroups() != null) {
            for (int i = 0; i < payload.internalGroups().size(); i++) {
                InternalGroup group = payload.internalGroups().get(i);
                if (group != null) validateOptionalSourceUrl(group.source(), "Внутренняя группа " + (i + 1));
            }
        }
        if (payload.mzkmDetails() != null) {
            for (Map.Entry<String, GroupDetail> entry : payload.mzkmDetails().entrySet()) {
                GroupDetail detail = entry.getValue();
                if (detail != null) {
                    String label = "Группа «" + safeLabel(entry.getKey()) + "»";
                    validateOptionalSourceUrl(detail.source(), label);
                }
            }
        }
    }

    private static void validateOptionalSourceUrl(String value, String label) {
        if (value == null || value.isBlank()) return;
        try {
            java.net.URI uri = java.net.URI.create(value.trim());
            String scheme = uri.getScheme();
            if (scheme == null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    || uri.getHost() == null || uri.getHost().isBlank()
                    || uri.getUserInfo() != null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(label
                    + ": источник должен быть полноценной ссылкой HTTP или HTTPS.");
        }
    }

    private static String safeLabel(String value) {
        if (value == null || value.isBlank()) return "без названия";
        String clean = value.trim();
        return clean.length() <= 120 ? clean : clean.substring(0, 120);
    }

    public record CatalogPayload(
            @NotNull @Size(max = 200) List<@NotBlankGroup String> mzkmGroups,
            @NotNull @Size(max = 200) List<@Valid InternalGroup> internalGroups,
            @NotNull Map<String, @Valid GroupDetail> mzkmDetails
    ) {}
    public record InternalGroup(@NotBlankGroup String name, @Size(max = 4000) String description, @Size(max = 2000) String source) {}
    public record GroupDetail(@Size(max = 4000) String description, @Size(max = 2000) String source) {}
    public record CatalogResponse(CatalogPayload payload, String updatedBy, Instant updatedAt) {}

    @jakarta.validation.Constraint(validatedBy = NotBlankGroupValidator.class)
    @java.lang.annotation.Target({java.lang.annotation.ElementType.FIELD, java.lang.annotation.ElementType.PARAMETER, java.lang.annotation.ElementType.RECORD_COMPONENT, java.lang.annotation.ElementType.TYPE_USE})
    @java.lang.annotation.Retention(java.lang.annotation.RetentionPolicy.RUNTIME)
    public @interface NotBlankGroup {
        String message() default "Название группы не должно быть пустым";
        Class<?>[] groups() default {};
        Class<? extends jakarta.validation.Payload>[] payload() default {};
    }
    public static class NotBlankGroupValidator implements jakarta.validation.ConstraintValidator<NotBlankGroup, String> {
        @Override public boolean isValid(String value, jakarta.validation.ConstraintValidatorContext context) {
            return value != null && !value.isBlank() && value.length() <= 240;
        }
    }
}