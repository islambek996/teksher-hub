ALTER TABLE
  business_process_guides
ADD
  COLUMN workflow_status VARCHAR(24) NOT NULL DEFAULT 'PUBLISHED',
ADD
  COLUMN review_comment VARCHAR(1000),
ADD
  COLUMN submitted_at TIMESTAMPTZ,
ADD
  COLUMN approved_by VARCHAR(120),
ADD
  COLUMN approved_at TIMESTAMPTZ,
ADD
  COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE
  business_process_guides
ADD
  CONSTRAINT chk_business_process_workflow_status CHECK (
    workflow_status IN ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED')
  );
CREATE INDEX idx_business_process_guides_workflow_status ON business_process_guides(workflow_status, order_index);