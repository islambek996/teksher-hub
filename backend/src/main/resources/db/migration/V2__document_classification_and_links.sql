ALTER TABLE
  documents
ADD
  COLUMN product_group VARCHAR(160);
ALTER TABLE
  documents
ADD
  COLUMN keywords VARCHAR(1000);
ALTER TABLE
  document_versions
ADD
  COLUMN product_group VARCHAR(160);
ALTER TABLE
  document_versions
ADD
  COLUMN keywords VARCHAR(1000);
CREATE TABLE document_links (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  related_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, related_document_id),
  CONSTRAINT document_links_not_self CHECK (document_id <> related_document_id)
);
CREATE INDEX idx_document_links_related ON document_links(related_document_id);