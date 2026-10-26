package kg.teksherhub.ai;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "ai_answer_feedback")
@Getter
@Setter
@NoArgsConstructor
public class AiAnswerFeedback {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 16)
    private String rating;

    @Column(length = 80)
    private String category;

    @Column(length = 120)
    private String username;

    @Column(name = "question_text", columnDefinition = "text")
    private String questionText = "";

    @Column(name = "answer_text", columnDefinition = "text")
    private String answerText = "";

    @Column(name = "source_titles", columnDefinition = "text", nullable = false)
    private String sourceTitles = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
