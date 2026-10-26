CREATE TABLE hub_task_comments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES hub_tasks(id) ON DELETE CASCADE,
    username VARCHAR(120) NOT NULL,
    body VARCHAR(1500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hub_task_comments_task ON hub_task_comments(task_id, created_at ASC);

CREATE TABLE hub_notifications (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(120) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    task_id BIGINT REFERENCES hub_tasks(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hub_notifications_user_unread ON hub_notifications(username, read_at, created_at DESC);
