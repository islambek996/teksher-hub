package kg.teksherhub.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AiAnswerFeedbackRepository extends JpaRepository<AiAnswerFeedback, Long> {
    long countByRating(String rating);
    List<AiAnswerFeedback> findTop10ByRatingOrderByCreatedAtDesc(String rating);

    @Query("select coalesce(f.category, 'other') as category, count(f) as total " +
           "from AiAnswerFeedback f where f.rating = :rating " +
           "group by coalesce(f.category, 'other') order by count(f) desc")
    List<Object[]> countCategoriesByRating(@Param("rating") String rating);
}
