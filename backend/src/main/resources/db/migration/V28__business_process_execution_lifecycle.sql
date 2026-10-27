ALTER TABLE business_process_progress
    ADD COLUMN execution_status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
    ADD COLUMN started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN completed_at TIMESTAMPTZ;

ALTER TABLE business_process_progress
    ADD CONSTRAINT chk_business_process_execution_status
    CHECK (execution_status IN ('IN_PROGRESS', 'COMPLETED'));

CREATE INDEX idx_business_process_progress_status
    ON business_process_progress(execution_status, updated_at DESC);
