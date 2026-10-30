CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(180) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'READER',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'EDITOR', 'READER'))
);
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  jurisdiction VARCHAR(10) NOT NULL,
  kind VARCHAR(60) NOT NULL,
  area VARCHAR(120) NOT NULL,
  document_number VARCHAR(120),
  document_date DATE,
  effective_from DATE,
  effective_until DATE,
  source_url TEXT,
  description VARCHAR(3000) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  official_source_checked_at TIMESTAMPTZ,
  source_check_note VARCHAR(1000),
  created_by VARCHAR(120) NOT NULL,
  updated_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version_number INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT documents_jurisdiction_check CHECK (jurisdiction IN ('RU', 'KG', 'EAEU')),
  CONSTRAINT documents_status_check CHECK (
    status IN (
      'DRAFT',
      'UNDER_REVIEW',
      'ACTIVE',
      'EXPIRED',
      'ARCHIVED'
    )
  )
);
CREATE INDEX idx_documents_title ON documents USING gin (to_tsvector('simple', title));
CREATE INDEX idx_documents_jurisdiction ON documents(jurisdiction);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);
CREATE TABLE document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(240) NOT NULL,
  jurisdiction VARCHAR(10) NOT NULL,
  kind VARCHAR(60) NOT NULL,
  area VARCHAR(120) NOT NULL,
  document_number VARCHAR(120),
  document_date DATE,
  effective_from DATE,
  effective_until DATE,
  source_url TEXT,
  description VARCHAR(3000) NOT NULL,
  status VARCHAR(24) NOT NULL,
  change_note VARCHAR(1000),
  changed_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);
CREATE INDEX idx_document_versions_document ON document_versions(document_id, version_number DESC);
CREATE TABLE document_files (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  content_type VARCHAR(160) NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by VARCHAR(120) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_files_document ON document_files(document_id);
CREATE TABLE source_monitors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  jurisdiction VARCHAR(10) NOT NULL,
  source_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_hours INTEGER NOT NULL DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  last_http_status INTEGER,
  last_content_hash VARCHAR(128),
  last_change_detected_at TIMESTAMPTZ,
  last_error VARCHAR(1000),
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_monitors_jurisdiction_check CHECK (jurisdiction IN ('RU', 'KG', 'EAEU')),
  CONSTRAINT source_monitors_interval_check CHECK (interval_hours BETWEEN 1 AND 720)
);