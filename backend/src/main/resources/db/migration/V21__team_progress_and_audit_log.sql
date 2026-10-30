CREATE TABLE business_process_progress (
  username VARCHAR(120) NOT NULL,
  process_id VARCHAR(80) NOT NULL,
  completed_steps_json TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (username, process_id)
);
CREATE INDEX idx_business_process_progress_updated ON business_process_progress(updated_at DESC);
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(120) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  entity_label VARCHAR(240),
  details VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_username ON audit_log(username, created_at DESC);