ALTER TABLE marking_issues
    ADD COLUMN IF NOT EXISTS solution_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS solution_verified_by VARCHAR(120),
    ADD COLUMN IF NOT EXISTS solution_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_marking_issues_solution_verified
    ON marking_issues(solution_verified, updated_at DESC);
