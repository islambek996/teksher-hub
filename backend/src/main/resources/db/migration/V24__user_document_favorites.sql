CREATE TABLE user_document_favorites (
  username VARCHAR(120) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (username, document_id)
);
CREATE INDEX idx_user_document_favorites_created ON user_document_favorites(username, created_at DESC);