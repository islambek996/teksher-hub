package kg.teksherhub.process;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class BusinessProcessGuideService {
    private static final TypeReference<List<BusinessProcessStep>> STEPS_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<BusinessProcessSource>> SOURCES_TYPE = new TypeReference<>() {};

    private final BusinessProcessGuideRepository repository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;

    public BusinessProcessGuideService(BusinessProcessGuideRepository repository, ObjectMapper objectMapper, JdbcTemplate jdbc) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<BusinessProcessGuideResponse> list() {
        return repository.findAllByOrderByOrderIndexAscTitleAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BusinessProcessGuideResponse create(BusinessProcessGuideRequest request, String username) {
        BusinessProcessGuide guide = new BusinessProcessGuide();
        guide.setId(UUID.randomUUID().toString());
        guide.setCreatedBy(username);
        guide.setCreatedAt(Instant.now());
        int nextOrder = repository.findAllByOrderByOrderIndexAscTitleAsc().stream()
                .mapToInt(BusinessProcessGuide::getOrderIndex).max().orElse(0) + 1;
        apply(guide, request, username, nextOrder);
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "CREATE");
        recordAudit(username, "CREATE", saved.id(), saved.title(), "Создан бизнес-процесс");
        return saved;
    }

    @Transactional
    public BusinessProcessGuideResponse update(String id, BusinessProcessGuideRequest request, String username) {
        BusinessProcessGuide guide = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Бизнес-процесс не найден: " + id));
        apply(guide, request, username, guide.getOrderIndex());
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "UPDATE");
        recordAudit(username, "UPDATE", saved.id(), saved.title(), "Обновлён бизнес-процесс");
        return saved;
    }

    @Transactional
    public void delete(String id, String username) {
        BusinessProcessGuide guide = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Бизнес-процесс не найден: " + id));
        jdbc.update("DELETE FROM business_process_progress WHERE process_id = ?", guide.getId());
        recordAudit(username, "DELETE", guide.getId(), guide.getTitle(), "Бизнес-процесс удалён");
        repository.delete(guide);
    }

    @Transactional(readOnly = true)
    public List<GuideVersion> versions(String processId) {
        return jdbc.query("""
                SELECT version_number, action, title, changed_by, changed_at
                FROM business_process_guide_versions
                WHERE process_id = ?
                ORDER BY version_number DESC
                """,
                (rs, rowNum) -> new GuideVersion(
                        rs.getInt("version_number"),
                        rs.getString("action"),
                        rs.getString("title"),
                        rs.getString("changed_by"),
                        rs.getTimestamp("changed_at").toInstant()),
                processId);
    }

    @Transactional
    public BusinessProcessGuideResponse restore(String processId, int versionNumber, String username) {
        String snapshot = jdbc.query(
                "SELECT snapshot_json FROM business_process_guide_versions WHERE process_id = ? AND version_number = ?",
                rs -> rs.next() ? rs.getString("snapshot_json") : null,
                processId, versionNumber);
        if (snapshot == null || snapshot.isBlank()) {
            throw new IllegalArgumentException("Версия бизнес-процесса не найдена.");
        }
        final BusinessProcessGuideResponse previous;
        try {
            previous = objectMapper.readValue(snapshot, BusinessProcessGuideResponse.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Не удалось прочитать сохранённую версию процесса.", ex);
        }
        BusinessProcessGuide guide = repository.findById(processId).orElseGet(() -> {
            BusinessProcessGuide created = new BusinessProcessGuide();
            created.setId(processId);
            created.setCreatedBy(username);
            created.setCreatedAt(Instant.now());
            return created;
        });
        BusinessProcessGuideRequest request = new BusinessProcessGuideRequest(
                previous.category(), previous.title(), previous.summary(), previous.scope(),
                previous.time(), previous.searchTerm(), previous.sources(), previous.steps(), previous.orderIndex());
        apply(guide, request, username, previous.orderIndex());
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "RESTORE");
        recordAudit(username, "RESTORE", processId, saved.title(),
                "Восстановлена версия " + versionNumber);
        return saved;
    }

    private void recordVersion(BusinessProcessGuideResponse response, String username, String action) {
        try {
            String snapshot = objectMapper.writeValueAsString(response);
            Integer next = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(version_number), 0) + 1 FROM business_process_guide_versions WHERE process_id = ?",
                    Integer.class, response.id());
            jdbc.update("""
                    INSERT INTO business_process_guide_versions
                    (process_id, version_number, action, title, snapshot_json, changed_by, changed_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    """, response.id(), next == null ? 1 : next, action, response.title(), snapshot, username);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Не удалось сохранить историю версии процесса.", ex);
        }
    }

    private void recordAudit(String username, String action, String processId, String title, String details) {
        jdbc.update("""
                INSERT INTO audit_log(username, action, entity_type, entity_id, entity_label, details, created_at)
                VALUES (?, ?, 'BUSINESS_PROCESS', ?, ?, ?, NOW())
                """, username, action, processId, title, details);
    }

    public record GuideVersion(int versionNumber, String action, String title, String changedBy, Instant changedAt) {}

    private void apply(BusinessProcessGuide guide, BusinessProcessGuideRequest request, String username, int fallbackOrder) {
        if (request.steps() == null || request.steps().isEmpty()) {
            throw new IllegalArgumentException("Добавьте хотя бы один шаг.");
        }
        if (request.steps().size() > 30) {
            throw new IllegalArgumentException("В одной инструкции может быть не более 30 шагов.");
        }
        if (request.steps().stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Каждый шаг должен содержать название и описание.");
        }
        if (request.sources() != null && request.sources().stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Некорректная ссылка в инструкции.");
        }
        List<BusinessProcessSource> sources = request.sources() == null
                ? List.of()
                : request.sources().stream()
                    .map(source -> new BusinessProcessSource(
                            source.label().trim(), source.url().trim()))
                    .toList();
        List<BusinessProcessStep> steps = request.steps().stream()
                .map(step -> new BusinessProcessStep(
                        step.title().trim(),
                        step.detail().trim(),
                        clean(step.responsible()),
                        clean(step.documents()),
                        clean(step.decision()),
                        clean(step.yesOutcome()),
                        clean(step.noOutcome()),
                        step.yesStepIndex(),
                        step.noStepIndex()))
                .toList();
        if (steps.isEmpty()) {
            throw new IllegalArgumentException("Добавьте хотя бы один шаг.");
        }

        guide.setCategory(request.category().trim());
        guide.setTitle(request.title().trim());
        guide.setSummary(request.summary().trim());
        guide.setScope(request.scope().trim());
        guide.setTime(request.time().trim());
        guide.setSearchTerm(request.searchTerm().trim());
        guide.setSourcesJson(writeJson(sources));
        guide.setStepsJson(writeJson(steps));
        guide.setOrderIndex(request.orderIndex() == null ? fallbackOrder : request.orderIndex());
        guide.setUpdatedBy(username);
        guide.setUpdatedAt(Instant.now());
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private BusinessProcessGuideResponse toResponse(BusinessProcessGuide guide) {
        return new BusinessProcessGuideResponse(
                guide.getId(), guide.getCategory(), guide.getTitle(), guide.getSummary(),
                guide.getScope(), guide.getTime(), guide.getSearchTerm(),
                readJson(guide.getSourcesJson(), SOURCES_TYPE),
                readJson(guide.getStepsJson(), STEPS_TYPE),
                guide.getOrderIndex(), guide.getCreatedBy(), guide.getUpdatedBy(), guide.getUpdatedAt()
        );
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Не удалось сериализовать данные инструкции.", exception);
        }
    }

    private <T> List<T> readJson(String json, TypeReference<List<T>> type) {
        try {
            List<T> result = objectMapper.readValue(json == null || json.isBlank() ? "[]" : json, type);
            return result == null ? new ArrayList<>() : List.copyOf(result);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Не удалось прочитать данные инструкции из базы.", exception);
        }
    }
}
