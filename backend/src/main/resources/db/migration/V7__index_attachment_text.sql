ALTER TABLE
  document_files
ADD
  COLUMN extracted_text TEXT NOT NULL DEFAULT '',
ADD
  COLUMN text_extraction_status VARCHAR(24) NOT NULL DEFAULT 'NOT_INDEXED',
ADD
  COLUMN text_extraction_note VARCHAR(500);
CREATE INDEX idx_document_files_extraction_status ON document_files(text_extraction_status);