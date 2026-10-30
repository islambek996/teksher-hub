CREATE TABLE IF NOT EXISTS business_process_guide_versions (
  id BIGSERIAL PRIMARY KEY,
  process_id VARCHAR(80) NOT NULL,
  version_number INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL,
  title VARCHAR(240) NOT NULL,
  snapshot_json TEXT NOT NULL,
  changed_by VARCHAR(120) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_business_process_guide_version UNIQUE (process_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_process_guide_versions_process ON business_process_guide_versions(process_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_process_guide_versions_changed ON business_process_guide_versions(changed_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(120) NOT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  entity_label VARCHAR(240),
  details VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username, created_at DESC);