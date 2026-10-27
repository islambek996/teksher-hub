package kg.teksherhub.process;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BusinessProcessStepTransitionTest {
    @Test
    void acceptsValidBranchTargetsAndDecision() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", "Продолжить", "Исправить", 1, 2),
                new BusinessProcessStep("Продолжить", "Следующий этап", null, null,
                        null, null, null, null, null),
                new BusinessProcessStep("Исправить", "Устранить ошибки", null, null,
                        null, null, null, null, null)
        );

        assertDoesNotThrow(() -> BusinessProcessGuideService.validateStepTransitions(steps));
    }

    @Test
    void rejectsTargetOutsideStepList() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", null, null, 4, null)
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));

        assertTrue(error.getMessage().contains("существующий шаг"));
    }

    @Test
    void rejectsNegativeTarget() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        "Данные корректны?", null, null, null, -1)
        );

        assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));
    }

    @Test
    void rejectsBranchWithoutDecisionQuestion() {
        List<BusinessProcessStep> steps = List.of(
                new BusinessProcessStep("Проверка", "Проверь данные", null, null,
                        " ", null, null, 0, null)
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> BusinessProcessGuideService.validateStepTransitions(steps));

        assertTrue(error.getMessage().contains("контрольный вопрос"));
    }
}
