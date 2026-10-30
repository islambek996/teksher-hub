ALTER TABLE
  documents
ADD
  COLUMN content TEXT NOT NULL DEFAULT '';
ALTER TABLE
  document_versions
ADD
  COLUMN content TEXT NOT NULL DEFAULT '';