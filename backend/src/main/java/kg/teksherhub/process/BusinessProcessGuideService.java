package kg.teksherhub.process;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
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

    public BusinessProcessGuideService(BusinessProcessGuideRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
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
        return toResponse(repository.save(guide));
    }

    @Transactional
    public BusinessProcessGuideResponse update(String id, BusinessProcessGuideRequest request, String username) {
        BusinessProcessGuide guide = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Бизнес-процесс не найден: " + id));
        apply(guide, request, username, guide.getOrderIndex());
        return toResponse(repository.save(guide));
    }

    @Transactional
    public void delete(String id) {
        BusinessProcessGuide guide = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Бизнес-процесс не найден: " + id));
        repository.delete(guide);
    }

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
                .map(step -> new BusinessProcessStep(step.title().trim(), step.detail().trim()))
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
