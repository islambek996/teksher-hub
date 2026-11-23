-- Add a weighted full-text index for the shared knowledge catalogue.
-- Russian stemming improves matching across grammatical forms; exact substring
-- matching remains available as a fallback in DocumentService for codes and fragments.

ALTER TABLE documents
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(document_number, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(keywords, '')), 'B') ||
        setweight(to_tsvector('russian', coalesce(product_group, '')), 'B') ||
        setweight(to_tsvector('russian', coalesce(jurisdiction, '')), 'C') ||
        setweight(to_tsvector('russian', coalesce(kind, '')), 'C') ||
        setweight(to_tsvector('russian', coalesce(area, '')), 'C') ||
        setweight(to_tsvector('russian', coalesce(description, '')), 'D') ||
        setweight(to_tsvector('russian', coalesce(content, '')), 'D')
    ) STORED;

CREATE INDEX idx_documents_search_vector
    ON documents USING GIN (search_vector);
