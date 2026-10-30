CREATE TABLE ai_answer_feedback (
    id BIGSERIAL PRIMARY KEY,
    rating VARCHAR(16) NOT NULL CHECK (rating IN ('positive', 'negative')),
    category VARCHAR(80),
    username VARCHAR(120),
    question_text TEXT NOT NULL DEFAULT '',
    answer_text TEXT NOT NULL DEFAULT '',
    source_titles TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_answer_feedback_rating_created
    ON ai_answer_feedback (rating, created_at DESC);

CREATE INDEX idx_ai_answer_feedback_created
    ON ai_answer_feedback (created_at DESC);
