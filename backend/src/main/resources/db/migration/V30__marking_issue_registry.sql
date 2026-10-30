CREATE TABLE IF NOT EXISTS marking_issues (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  description VARCHAR(4000) NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'TECHNICAL',
  system_name VARCHAR(30) NOT NULL DEFAULT 'MZKM',
  jurisdiction VARCHAR(10) NOT NULL DEFAULT 'KG',
  product_group VARCHAR(240),
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(24) NOT NULL DEFAULT 'NEW',
  assigned_to VARCHAR(120),
  created_by VARCHAR(120) NOT NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT chk_marking_issues_category CHECK (
    category IN (
      'TECHNICAL',
      'REGULATORY',
      'PRODUCT_CARD',
      'CODE_ORDER',
      'APPLICATION',
      'CODE_MOVEMENT',
      'OTHER'
    )
  ),
  CONSTRAINT chk_marking_issues_system CHECK (
    system_name IN (
      'MZKM',
      'GAIS_MT',
      'TRANSGRAN',
      'CROSS_BORDER',
      'OTHER'
    )
  ),
  CONSTRAINT chk_marking_issues_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_marking_issues_status CHECK (
    status IN (
      'NEW',
      'IN_PROGRESS',
      'WAITING',
      'RESOLVED',
      'CLOSED'
    )
  )
);
CREATE INDEX IF NOT EXISTS idx_marking_issues_status_priority ON marking_issues(status, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marking_issues_created_by ON marking_issues(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marking_issues_assigned_to ON marking_issues(assigned_to, status);
CREATE TABLE IF NOT EXISTS marking_issue_comments (
  id BIGSERIAL PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES marking_issues(id) ON DELETE CASCADE,
  username VARCHAR(120) NOT NULL,
  body VARCHAR(3000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marking_issue_comments_issue ON marking_issue_comments(issue_id, created_at);