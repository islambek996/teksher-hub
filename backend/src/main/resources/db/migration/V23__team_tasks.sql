CREATE TABLE IF NOT EXISTS hub_tasks (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  description VARCHAR(1500) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'TODO',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  due_date DATE,
  created_by VARCHAR(120) NOT NULL,
  assigned_to VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_hub_tasks_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  CONSTRAINT chk_hub_tasks_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH'))
);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_assigned_status ON hub_tasks(assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_created_by ON hub_tasks(created_by, created_at DESC);