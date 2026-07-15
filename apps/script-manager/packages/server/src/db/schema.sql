CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  active_environment_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vars_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_environments_workspace ON environments(workspace_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  runtime TEXT NOT NULL,
  docker_image TEXT,
  docker_platform TEXT,
  trigger_type TEXT NOT NULL,
  trigger_glob TEXT,
  trigger_cron TEXT,
  concurrency TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  exit_code INTEGER,
  trigger_reason TEXT NOT NULL,
  log_path TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id, started_at DESC);
