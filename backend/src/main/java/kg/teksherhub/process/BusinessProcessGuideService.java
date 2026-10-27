package kg.teksherhub.process;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.Set;
import java.util.LinkedHashSet;

@Service
public class BusinessProcessGuideService {
    private static final TypeReference<List<BusinessProcessStep>> STEPS_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<BusinessProcessSource>> SOURCES_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<String>> PROGRESS_TYPE = new TypeReference<>() {};

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

    @Transactional(readOnly = true)
    public boolean isPublished(String processId) {
        return repository.findById(processId)
                .map(guide -> "PUBLISHED".equals(guide.getWorkflowStatus()))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public List<BusinessProcessGuideResponse> publishedList() {
        return repository.findAllByOrderByOrderIndexAscTitleAsc().stream()
                .map(this::toResponse)
                .filter(item -> "PUBLISHED".equals(item.workflowStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkflowOverview overview() {
        List<WorkflowStatusCount> counts = jdbc.query(
                "SELECT workflow_status, COUNT(*) AS total FROM business_process_guides GROUP BY workflow_status ORDER BY workflow_status",
                (rs, rowNum) -> new WorkflowStatusCount(rs.getString("workflow_status"), rs.getLong("total")));
        List<ProcessExecutionSummary> executions = jdbc.query("""
                SELECT p.process_id, g.title, g.workflow_status, p.username,
                       COALESCE(u.display_name, p.username) AS display_name,
                       p.completed_steps_json, p.updated_at, p.started_at, p.completed_at,
                       p.execution_status, g.steps_json
                FROM business_process_progress p
                JOIN business_process_guides g ON g.id = p.process_id
                LEFT JOIN users u ON u.username = p.username
                ORDER BY p.updated_at DESC
                LIMIT 1000
                """, (rs, rowNum) -> {
            int totalSteps = readJson(rs.getString("steps_json"), STEPS_TYPE).size();
            int completedSteps = 0;
            try {
                List<String> stored = objectMapper.readValue(
                        rs.getString("completed_steps_json") == null ? "[]" : rs.getString("completed_steps_json"),
                        PROGRESS_TYPE);
                Set<Integer> valid = new LinkedHashSet<>();
                if (stored != null) {
                    for (String value : stored) {
                        try {
                            int index = Integer.parseInt(value);
                            if (index >= 0 && index < totalSteps) valid.add(index);
                        } catch (NumberFormatException ignored) {
                            // Ignore old or invalid indexes in the manager overview.
                        }
                    }
                }
                completedSteps = valid.size();
            } catch (JsonProcessingException ignored) {
                // One damaged progress row must not make the entire overview unavailable.
            }
            int percent = totalSteps == 0 ? 0 : Math.round(completedSteps * 100f / totalSteps);
            java.sql.Timestamp completedAt = rs.getTimestamp("completed_at");
            return new ProcessExecutionSummary(
                    rs.getString("process_id"), rs.getString("title"), rs.getString("workflow_status"),
                    rs.getString("username"), rs.getString("display_name"), completedSteps, totalSteps,
                    percent, rs.getString("execution_status"), rs.getTimestamp("started_at").toInstant(),
                    completedAt == null ? null : completedAt.toInstant(), rs.getTimestamp("updated_at").toInstant());
        });
        return new WorkflowOverview(counts, executions);
    }

    public record WorkflowStatusCount(String status, long total) {}
    public record ProcessExecutionSummary(String processId, String title, String workflowStatus,
            String username, String displayName, int completedSteps, int totalSteps,
            int progressPercent, String executionStatus, Instant startedAt, Instant completedAt, Instant updatedAt) {}
    public record WorkflowOverview(List<WorkflowStatusCount> statusCounts,
            List<ProcessExecutionSummary> executions) {}

    @Transactional
    public BusinessProcessGuideResponse submitForReview(String id, String username) {
        BusinessProcessGuide guide = requireGuide(id);
        if (!"DRAFT".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("На согласование можно отправить только черновик.");
        }
        guide.setWorkflowStatus("IN_REVIEW");
        guide.setSubmittedAt(Instant.now());
        guide.setReviewComment(null);
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "SUBMIT_FOR_REVIEW");
        recordAudit(username, "SUBMIT_FOR_REVIEW", id, saved.title(), "Процесс отправлен на согласование");
        return saved;
    }

    @Transactional
    public BusinessProcessGuideResponse publish(String id, String username) {
        BusinessProcessGuide guide = requireGuide(id);
        if (!"DRAFT".equals(guide.getWorkflowStatus()) && !"IN_REVIEW".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("Опубликовать можно только черновик или процесс на согласовании.");
        }
        guide.setWorkflowStatus("PUBLISHED");
        guide.setApprovedBy(username);
        guide.setApprovedAt(Instant.now());
        guide.setReviewComment(null);
        guide.setArchivedAt(null);
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "PUBLISH");
        recordAudit(username, "PUBLISH", id, saved.title(), "Процесс опубликован");
        return saved;
    }

    @Transactional
    public BusinessProcessGuideResponse returnForRevision(String id, String comment, String username) {
        BusinessProcessGuide guide = requireGuide(id);
        if (!"IN_REVIEW".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("На доработку можно вернуть только процесс на согласовании.");
        }
        String reason = comment == null ? "" : comment.trim();
        if (reason.isEmpty()) {
            throw new IllegalArgumentException("Укажите причину возврата на доработку.");
        }
        if (reason.length() > 1000) throw new IllegalArgumentException("Причина не должна превышать 1000 символов.");
        guide.setWorkflowStatus("DRAFT");
        guide.setReviewComment(reason);
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "RETURN_FOR_REVISION");
        recordAudit(username, "RETURN_FOR_REVISION", id, saved.title(), reason);
        return saved;
    }

    @Transactional
    public BusinessProcessGuideResponse archive(String id, String username) {
        BusinessProcessGuide guide = requireGuide(id);
        if (!"PUBLISHED".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("В архив можно отправить только опубликованный процесс.");
        }
        guide.setWorkflowStatus("ARCHIVED");
        guide.setArchivedAt(Instant.now());
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "ARCHIVE");
        recordAudit(username, "ARCHIVE", id, saved.title(), "Процесс перемещён в архив");
        return saved;
    }

    @Transactional
    public BusinessProcessGuideResponse restoreArchived(String id, String username) {
        BusinessProcessGuide guide = requireGuide(id);
        if (!"ARCHIVED".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("В черновик можно вернуть только архивный процесс.");
        }
        guide.setWorkflowStatus("DRAFT");
        guide.setArchivedAt(null);
        guide.setApprovedBy(null);
        guide.setApprovedAt(null);
        guide.setSubmittedAt(null);
        guide.setReviewComment(null);
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "RESTORE_TO_DRAFT");
        recordAudit(username, "RESTORE_TO_DRAFT", id, saved.title(), "Процесс возвращён из архива в черновики");
        return saved;
    }

    private BusinessProcessGuide requireGuide(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Бизнес-процесс не найден: " + id));
    }

    @Transactional
    public BusinessProcessGuideResponse create(BusinessProcessGuideRequest request, String username) {
        BusinessProcessGuide guide = new BusinessProcessGuide();
        guide.setId(UUID.randomUUID().toString());
        guide.setWorkflowStatus("DRAFT");
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
        if ("IN_REVIEW".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("Процесс находится на согласовании. Дождитесь решения администратора.");
        }
        if ("ARCHIVED".equals(guide.getWorkflowStatus())) {
            throw new IllegalArgumentException("Архивный процесс сначала нужно вернуть в черновики.");
        }
        String previousStepsJson = guide.getStepsJson();
        boolean wasPublished = "PUBLISHED".equals(guide.getWorkflowStatus());
        apply(guide, request, username, guide.getOrderIndex());
        if (wasPublished) {
            guide.setWorkflowStatus("DRAFT");
            guide.setApprovedBy(null);
            guide.setApprovedAt(null);
            guide.setSubmittedAt(null);
            guide.setReviewComment(null);
        }
        if (!Objects.equals(previousStepsJson, guide.getStepsJson())) {
            resetAllProgress(guide.getId());
        }
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
    public List<DeletedGuide> deletedGuides() {
        return jdbc.query("""
                SELECT a.entity_id, a.entity_label, a.username, a.created_at,
                       (SELECT MAX(v.version_number)
                        FROM business_process_guide_versions v
                        WHERE v.process_id = a.entity_id) AS version_number
                FROM audit_log a
                WHERE a.entity_type = 'BUSINESS_PROCESS'
                  AND a.action = 'DELETE'
                  AND a.id = (
                      SELECT MAX(latest.id)
                      FROM audit_log latest
                      WHERE latest.entity_type = 'BUSINESS_PROCESS'
                        AND latest.entity_id = a.entity_id
                  )
                  AND EXISTS (
                      SELECT 1 FROM business_process_guide_versions v
                      WHERE v.process_id = a.entity_id
                  )
                ORDER BY a.created_at DESC
                """,
                (rs, rowNum) -> new DeletedGuide(
                        rs.getString("entity_id"),
                        rs.getString("entity_label"),
                        rs.getString("username"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getInt("version_number")));
    }

    @Transactional(readOnly = true)
    public List<GuideVersion> versions(String processId) {
        return jdbc.query("""
                SELECT version_number, action, title, changed_by, changed_at, snapshot_json
                FROM business_process_guide_versions
                WHERE process_id = ?
                ORDER BY version_number DESC
                """,
                (rs, rowNum) -> {
                    int stepCount = 0;
                    int branchCount = 0;
                    String snapshot = rs.getString("snapshot_json");
                    if (snapshot != null && !snapshot.isBlank()) {
                        try {
                            BusinessProcessGuideResponse saved =
                                    objectMapper.readValue(snapshot, BusinessProcessGuideResponse.class);
                            if (saved.steps() != null) {
                                stepCount = saved.steps().size();
                                branchCount = (int) saved.steps().stream()
                                        .filter(step -> step.yesStepIndex() != null || step.noStepIndex() != null)
                                        .count();
                            }
                        } catch (JsonProcessingException ex) {
                            throw new IllegalStateException("Не удалось прочитать сводку версии процесса.", ex);
                        }
                    }
                    return new GuideVersion(
                            rs.getInt("version_number"),
                            rs.getString("action"),
                            rs.getString("title"),
                            rs.getString("changed_by"),
                            rs.getTimestamp("changed_at").toInstant(),
                            stepCount,
                            branchCount);
                },
                processId);
    }

    @Transactional(readOnly = true)
    public BusinessProcessGuideResponse versionDetail(String processId, int versionNumber) {
        String snapshot = jdbc.query(
                "SELECT snapshot_json FROM business_process_guide_versions WHERE process_id = ? AND version_number = ?",
                rs -> rs.next() ? rs.getString("snapshot_json") : null,
                processId, versionNumber);
        if (snapshot == null || snapshot.isBlank()) {
            throw new IllegalArgumentException("Версия бизнес-процесса не найдена.");
        }
        try {
            return objectMapper.readValue(snapshot, BusinessProcessGuideResponse.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Не удалось прочитать сохранённую версию процесса.", ex);
        }
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
        String previousStepsJson = guide.getStepsJson();
        apply(guide, request, username, previous.orderIndex());
        guide.setWorkflowStatus("DRAFT");
        guide.setApprovedBy(null);
        guide.setApprovedAt(null);
        guide.setSubmittedAt(null);
        guide.setArchivedAt(null);
        guide.setReviewComment(null);
        if (!Objects.equals(previousStepsJson, guide.getStepsJson())) {
            resetAllProgress(guide.getId());
        }
        BusinessProcessGuideResponse saved = toResponse(repository.save(guide));
        recordVersion(saved, username, "RESTORE");
        recordAudit(username, "RESTORE", processId, saved.title(),
                "Восстановлена версия " + versionNumber);
        return saved;
    }

    private void resetAllProgress(String processId) {
        jdbc.update("DELETE FROM business_process_progress WHERE process_id = ?", processId);
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

    public record DeletedGuide(String processId, String title, String deletedBy, Instant deletedAt, int versionNumber) {}

    public record GuideVersion(int versionNumber, String action, String title, String changedBy, Instant changedAt, int stepCount, int branchCount) {}

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
        validateSources(request.sources());
        List<BusinessProcessSource> sources = request.sources() == null
                ? List.of()
                : request.sources().stream()
                    .map(source -> new BusinessProcessSource(
                            source.label().trim(), normalizeSourceUrl(source.url())))
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
        validateStepTransitions(steps);

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
                guide.getOrderIndex(), guide.getCreatedBy(), guide.getUpdatedBy(), guide.getUpdatedAt(),
                guide.getWorkflowStatus(), guide.getReviewComment(), guide.getSubmittedAt(),
                guide.getApprovedBy(), guide.getApprovedAt(), guide.getArchivedAt()
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

    static String normalizeSourceUrl(String value) {
        String url = value == null ? "" : value.trim();
        if (url.isEmpty()) {
            return url;
        }
        if (!url.matches("(?i)^[a-z][a-z0-9+.-]*://.*$")) {
            url = "https://" + url;
        }
        return url;
    }

    static void validateSources(List<BusinessProcessSource> sources) {
        if (sources == null) {
            return;
        }
        for (int i = 0; i < sources.size(); i++) {
            BusinessProcessSource source = sources.get(i);
            if (source == null) {
                throw new IllegalArgumentException("Источник " + (i + 1) + ": некорректная запись.");
            }
            String label = source.label() == null ? "" : source.label().trim();
            String url = normalizeSourceUrl(source.url());
            if (label.isEmpty() || url.isEmpty()) {
                throw new IllegalArgumentException("Источник " + (i + 1)
                        + ": укажите и название, и ссылку.");
            }
            if (label.length() > 200 || url.length() > 2000) {
                throw new IllegalArgumentException("Источник " + (i + 1)
                        + ": превышена допустимая длина названия или ссылки.");
            }
            try {
                URI parsed = URI.create(url);
                String scheme = parsed.getScheme();
                if (scheme == null
                        || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                        || parsed.getHost() == null || parsed.getHost().isBlank()) {
                    throw new IllegalArgumentException();
                }
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Источник " + (i + 1)
                        + ": укажите корректный адрес сайта, например teksher.kg.");
            }
        }
    }

    static void validateStepTransitions(List<BusinessProcessStep> steps) {
        for (int i = 0; i < steps.size(); i++) {
            BusinessProcessStep step = steps.get(i);
            validateTransitionTarget(step.yesStepIndex(), steps.size(), i, "положительной");
            validateTransitionTarget(step.noStepIndex(), steps.size(), i, "отрицательной");
            if ((step.yesStepIndex() != null || step.noStepIndex() != null)
                    && (step.decision() == null || step.decision().isBlank())) {
                throw new IllegalArgumentException(
                        "Для шага " + (i + 1) + " с ветвлением укажите контрольный вопрос.");
            }
        }
    }

    private static void validateTransitionTarget(Integer target, int stepCount, int sourceIndex, String branchName) {
        if (target == null) {
            return;
        }
        if (target < 0 || target >= stepCount) {
            throw new IllegalArgumentException(
                    "Некорректный переход " + branchName + " ветви шага " + (sourceIndex + 1)
                            + ": выберите существующий шаг.");
        }
        if (target == sourceIndex) {
            throw new IllegalArgumentException(
                    "Некорректный переход " + branchName + " ветви шага " + (sourceIndex + 1)
                            + ": переход не может вести на тот же шаг.");
        }
    }
}
