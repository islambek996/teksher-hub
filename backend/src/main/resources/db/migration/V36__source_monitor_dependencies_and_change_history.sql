-- Link monitored official sources to the exact knowledge materials and processes they support.
-- Explicit links avoid noisy host-based guesses when a portal homepage changes.

ALTER TABLE source_monitors
    ADD COLUMN last_content_type VARCHAR(160),
    ADD COLUMN last_content_snapshot TEXT;

CREATE TABLE source_monitor_documents (
    monitor_id BIGINT NOT NULL REFERENCES source_monitors(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    added_by VARCHAR(120) NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (monitor_id, document_id)
);
CREATE INDEX idx_source_monitor_documents_document ON source_monitor_documents(document_id);

CREATE TABLE source_monitor_processes (
    monitor_id BIGINT NOT NULL REFERENCES source_monitors(id) ON DELETE CASCADE,
    process_id VARCHAR(80) NOT NULL REFERENCES business_process_guides(id) ON DELETE CASCADE,
    added_by VARCHAR(120) NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (monitor_id, process_id)
);
CREATE INDEX idx_source_monitor_processes_process ON source_monitor_processes(process_id);

CREATE TABLE source_monitor_changes (
    id BIGSERIAL PRIMARY KEY,
    monitor_id BIGINT NOT NULL REFERENCES source_monitors(id) ON DELETE CASCADE,
    previous_hash VARCHAR(128) NOT NULL,
    current_hash VARCHAR(128) NOT NULL,
    previous_content_type VARCHAR(160),
    current_content_type VARCHAR(160),
    previous_content_snapshot TEXT,
    current_content_snapshot TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(120),
    review_note VARCHAR(1000),
    CONSTRAINT source_monitor_changes_status_check CHECK (status IN ('OPEN', 'ACKNOWLEDGED'))
);
CREATE INDEX idx_source_monitor_changes_monitor ON source_monitor_changes(monitor_id, detected_at DESC, id DESC);
CREATE INDEX idx_source_monitor_changes_open ON source_monitor_changes(monitor_id, status, detected_at DESC);
