package kg.teksherhub.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiAnswerFeedbackRepository extends JpaRepository<AiAnswerFeedback, Long> {
    long countByRating(String rating);
    List<AiAnswerFeedback> findTop10ByRatingOrderByCreatedAtDesc(String rating);
}
