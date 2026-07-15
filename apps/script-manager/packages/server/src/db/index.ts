import {
  DatabaseSync,
  type StatementSync,
  type SQLInputValue,
  type StatementResultingChanges,
} from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Workspace,
  Environment,
  Task,
  Execution,
  RuntimeKind,
  TriggerKind,
  ConcurrencyKind,
  ExecutionStatus,
} from '../types.js';
import { parseEnvVars, stringifyEnvVars } from '../executor/env.js';

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

interface WorkspaceRow {
  id: string;
  name: string;
  path: string;
  paused: number;
  active_environment_id: string | null;
  created_at: number;
}

interface EnvironmentRow {
  id: string;
  workspace_id: string;
  name: string;
  vars_json: string;
  created_at: number;
}

interface TaskRow {
  id: string;
  workspace_id: string;
  name: string;
  command: string;
  runtime: string;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: string;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: string;
  enabled: number;
  created_at: number;
}

interface ExecutionRow {
  id: string;
  task_id: string;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  exit_code: number | null;
  trigger_reason: string;
  log_path: string;
}

function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    paused: row.paused === 1,
    active_environment_id: row.active_environment_id,
    created_at: row.created_at,
  };
}

function rowToEnvironment(row: EnvironmentRow): Environment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    vars: parseEnvVars(row.vars_json),
    created_at: row.created_at,
  };
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    command: row.command,
    runtime: row.runtime as RuntimeKind,
    docker_image: row.docker_image,
    docker_platform: row.docker_platform,
    trigger_type: row.trigger_type as TriggerKind,
    trigger_glob: row.trigger_glob,
    trigger_cron: row.trigger_cron,
    concurrency: row.concurrency as ConcurrencyKind,
    enabled: row.enabled === 1,
    created_at: row.created_at,
  };
}

function rowToExecution(row: ExecutionRow): Execution {
  return {
    id: row.id,
    task_id: row.task_id,
    status: row.status as ExecutionStatus,
    started_at: row.started_at,
    ended_at: row.ended_at,
    exit_code: row.exit_code,
    trigger_reason: row.trigger_reason,
    log_path: row.log_path,
  };
}

export interface Store {
  listWorkspaces(): Workspace[];
  getWorkspace(id: string): Workspace | null;
  insertWorkspace(w: Workspace): void;
  setWorkspacePaused(id: string, paused: boolean): void;
  updateWorkspace(id: string, name: string, path: string): void;
  deleteWorkspace(id: string): void;

  deleteWorkspace(id: string): void;

  listEnvironments(workspaceId: string): Environment[];
  getEnvironment(id: string): Environment | null;
  insertEnvironment(env: Environment): void;
  updateEnvironment(id: string, name: string, vars: Record<string, string>): void;
  deleteEnvironment(id: string): void;
  setActiveEnvironment(workspaceId: string, environmentId: string | null): void;
  resolveActiveEnvVars(workspaceId: string): Record<string, string>;

  listTasks(workspaceId: string): Task[];
  listTasksPage(
    workspaceId: string,
    cursor: string | null,
    limit: number,
  ): { tasks: Task[]; nextCursor: string | null };
  listAllEnabledTasks(): Task[];
  getTask(id: string): Task | null;
  insertTask(t: Task): void;
  updateTask(t: Task): void;
  deleteTask(id: string): void;

  insertExecution(e: Execution): void;
  updateExecution(e: Execution): void;
  getExecution(id: string): Execution | null;
  listOpenExecutions(): Execution[];
  closeOpenExecutions(status: ExecutionStatus, endedAt: number): number;
  listExecutionsByTask(taskId: string, limit: number): Execution[];
  listRecentExecutions(limit: number): Execution[];

  close(): void;
}

interface Prepared<R> {
  all(...params: SQLInputValue[]): R[];
  get(...params: SQLInputValue[]): R | undefined;
  run(...params: SQLInputValue[]): StatementResultingChanges;
}

function prep<R = unknown>(db: DatabaseSync, sql: string): Prepared<R> {
  const stmt: StatementSync = db.prepare(sql);
  return {
    all(...params: SQLInputValue[]): R[] {
      return stmt.all(...params) as R[];
    },
    get(...params: SQLInputValue[]): R | undefined {
      return stmt.get(...params) as R | undefined;
    },
    run(...params: SQLInputValue[]): StatementResultingChanges {
      return stmt.run(...params);
    },
  };
}

export function openStore(dbPath: string): Store {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
  let hasDockerPlatform = false;
  for (const col of taskCols) {
    if (col.name === 'docker_platform') {
      hasDockerPlatform = true;
    }
  }
  if (!hasDockerPlatform) {
    db.exec('ALTER TABLE tasks ADD COLUMN docker_platform TEXT');
  }

  const wsCols = db.prepare('PRAGMA table_info(workspaces)').all() as { name: string }[];
  let hasActiveEnv = false;
  for (const col of wsCols) {
    if (col.name === 'active_environment_id') {
      hasActiveEnv = true;
    }
  }
  if (!hasActiveEnv) {
    db.exec('ALTER TABLE workspaces ADD COLUMN active_environment_id TEXT');
  }

  db.exec(`CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    vars_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    UNIQUE(workspace_id, name)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_environments_workspace ON environments(workspace_id)');

  const stmts = {
    listWorkspaces: prep<WorkspaceRow>(db, 'SELECT * FROM workspaces ORDER BY created_at ASC'),
    getWorkspace: prep<WorkspaceRow>(db, 'SELECT * FROM workspaces WHERE id = ?'),
    insertWorkspace: prep(
      db,
      'INSERT INTO workspaces (id, name, path, paused, active_environment_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    setWorkspacePaused: prep(db, 'UPDATE workspaces SET paused = ? WHERE id = ?'),
    updateWorkspace: prep(db, 'UPDATE workspaces SET name = ?, path = ? WHERE id = ?'),
    setActiveEnvironment: prep(db, 'UPDATE workspaces SET active_environment_id = ? WHERE id = ?'),
    deleteWorkspace: prep(db, 'DELETE FROM workspaces WHERE id = ?'),

    listEnvironmentsByWorkspace: prep<EnvironmentRow>(
      db,
      'SELECT * FROM environments WHERE workspace_id = ? ORDER BY created_at ASC',
    ),
    getEnvironment: prep<EnvironmentRow>(db, 'SELECT * FROM environments WHERE id = ?'),
    insertEnvironment: prep(
      db,
      'INSERT INTO environments (id, workspace_id, name, vars_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
    updateEnvironment: prep(db, 'UPDATE environments SET name = ?, vars_json = ? WHERE id = ?'),
    deleteEnvironment: prep(db, 'DELETE FROM environments WHERE id = ?'),

    listTasksByWorkspace: prep<TaskRow>(
      db,
      'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at ASC, id ASC',
    ),
    listTasksPageFirst: prep<TaskRow>(
      db,
      'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at ASC, id ASC LIMIT ?',
    ),
    listTasksPageAfter: prep<TaskRow>(
      db,
      `SELECT * FROM tasks WHERE workspace_id = ?
       AND (created_at > ? OR (created_at = ? AND id > ?))
       ORDER BY created_at ASC, id ASC LIMIT ?`,
    ),
    listAllEnabledTasks: prep<TaskRow>(db, 'SELECT * FROM tasks WHERE enabled = 1'),
    getTask: prep<TaskRow>(db, 'SELECT * FROM tasks WHERE id = ?'),
    insertTask: prep(
      db,
      `INSERT INTO tasks
        (id, workspace_id, name, command, runtime, docker_image, docker_platform, trigger_type, trigger_glob, trigger_cron, concurrency, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateTask: prep(
      db,
      `UPDATE tasks SET
        name = ?, command = ?, runtime = ?, docker_image = ?, docker_platform = ?,
        trigger_type = ?, trigger_glob = ?, trigger_cron = ?,
        concurrency = ?, enabled = ?
       WHERE id = ?`,
    ),
    deleteTask: prep(db, 'DELETE FROM tasks WHERE id = ?'),

    insertExecution: prep(
      db,
      `INSERT INTO executions
        (id, task_id, status, started_at, ended_at, exit_code, trigger_reason, log_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateExecution: prep(
      db,
      `UPDATE executions SET
        status = ?, started_at = ?, ended_at = ?, exit_code = ?
       WHERE id = ?`,
    ),
    getExecution: prep<ExecutionRow>(db, 'SELECT * FROM executions WHERE id = ?'),
    listOpenExecutions: prep<ExecutionRow>(
      db,
      `SELECT * FROM executions
       WHERE status IN ('running', 'pending') AND ended_at IS NULL
       ORDER BY COALESCE(started_at, 0) ASC`,
    ),
    closeOpenExecutions: prep(
      db,
      `UPDATE executions
       SET status = ?, ended_at = ?, exit_code = NULL
       WHERE status IN ('running', 'pending') AND ended_at IS NULL`,
    ),
    listExecutionsByTask: prep<ExecutionRow>(
      db,
      'SELECT * FROM executions WHERE task_id = ? ORDER BY COALESCE(started_at, 0) DESC LIMIT ?',
    ),
    listRecentExecutions: prep<ExecutionRow>(
      db,
      'SELECT * FROM executions ORDER BY COALESCE(started_at, 0) DESC LIMIT ?',
    ),
  };

  function boolToInt(value: boolean): number {
    if (value) {
      return 1;
    }
    return 0;
  }

  return {
    listWorkspaces(): Workspace[] {
      const rows = stmts.listWorkspaces.all();
      return rows.map(rowToWorkspace);
    },
    getWorkspace(id: string): Workspace | null {
      const row = stmts.getWorkspace.get(id);
      if (row === undefined) {
        return null;
      }
      return rowToWorkspace(row);
    },
    insertWorkspace(w: Workspace): void {
      stmts.insertWorkspace.run(
        w.id,
        w.name,
        w.path,
        boolToInt(w.paused),
        w.active_environment_id,
        w.created_at,
      );
    },
    setWorkspacePaused(id: string, paused: boolean): void {
      stmts.setWorkspacePaused.run(boolToInt(paused), id);
    },
    updateWorkspace(id: string, name: string, path: string): void {
      stmts.updateWorkspace.run(name, path, id);
    },
    deleteWorkspace(id: string): void {
      stmts.deleteWorkspace.run(id);
    },

    listEnvironments(workspaceId: string): Environment[] {
      const rows = stmts.listEnvironmentsByWorkspace.all(workspaceId);
      return rows.map(rowToEnvironment);
    },
    getEnvironment(id: string): Environment | null {
      const row = stmts.getEnvironment.get(id);
      if (row === undefined) {
        return null;
      }
      return rowToEnvironment(row);
    },
    insertEnvironment(env: Environment): void {
      stmts.insertEnvironment.run(
        env.id,
        env.workspace_id,
        env.name,
        stringifyEnvVars(env.vars),
        env.created_at,
      );
    },
    updateEnvironment(id: string, name: string, vars: Record<string, string>): void {
      stmts.updateEnvironment.run(name, stringifyEnvVars(vars), id);
    },
    deleteEnvironment(id: string): void {
      stmts.deleteEnvironment.run(id);
    },
    setActiveEnvironment(workspaceId: string, environmentId: string | null): void {
      stmts.setActiveEnvironment.run(environmentId, workspaceId);
    },
    resolveActiveEnvVars(workspaceId: string): Record<string, string> {
      const w = stmts.getWorkspace.get(workspaceId);
      if (w === undefined || w.active_environment_id === null) {
        return {};
      }
      const env = stmts.getEnvironment.get(w.active_environment_id);
      if (env === undefined) {
        return {};
      }
      return parseEnvVars(env.vars_json);
    },

    listTasks(workspaceId: string): Task[] {
      const rows = stmts.listTasksByWorkspace.all(workspaceId);
      return rows.map(rowToTask);
    },
    listTasksPage(
      workspaceId: string,
      cursor: string | null,
      limit: number,
    ): { tasks: Task[]; nextCursor: string | null } {
      const fetchLimit = limit + 1;
      let rows: TaskRow[];
      if (cursor === null) {
        rows = stmts.listTasksPageFirst.all(workspaceId, fetchLimit);
      } else {
        const cur = stmts.getTask.get(cursor);
        if (cur === undefined) {
          rows = stmts.listTasksPageFirst.all(workspaceId, fetchLimit);
        } else {
          rows = stmts.listTasksPageAfter.all(
            workspaceId,
            cur.created_at,
            cur.created_at,
            cur.id,
            fetchLimit,
          );
        }
      }
      let nextCursor: string | null = null;
      let pageRows = rows;
      if (rows.length > limit) {
        pageRows = rows.slice(0, limit);
        const last = pageRows[pageRows.length - 1];
        if (last !== undefined) {
          nextCursor = last.id;
        }
      }
      return { tasks: pageRows.map(rowToTask), nextCursor };
    },
    listAllEnabledTasks(): Task[] {
      const rows = stmts.listAllEnabledTasks.all();
      return rows.map(rowToTask);
    },
    getTask(id: string): Task | null {
      const row = stmts.getTask.get(id);
      if (row === undefined) {
        return null;
      }
      return rowToTask(row);
    },
    insertTask(t: Task): void {
      stmts.insertTask.run(
        t.id,
        t.workspace_id,
        t.name,
        t.command,
        t.runtime,
        t.docker_image,
        t.docker_platform,
        t.trigger_type,
        t.trigger_glob,
        t.trigger_cron,
        t.concurrency,
        boolToInt(t.enabled),
        t.created_at,
      );
    },
    updateTask(t: Task): void {
      stmts.updateTask.run(
        t.name,
        t.command,
        t.runtime,
        t.docker_image,
        t.docker_platform,
        t.trigger_type,
        t.trigger_glob,
        t.trigger_cron,
        t.concurrency,
        boolToInt(t.enabled),
        t.id,
      );
    },
    deleteTask(id: string): void {
      stmts.deleteTask.run(id);
    },

    insertExecution(e: Execution): void {
      stmts.insertExecution.run(
        e.id,
        e.task_id,
        e.status,
        e.started_at,
        e.ended_at,
        e.exit_code,
        e.trigger_reason,
        e.log_path,
      );
    },
    updateExecution(e: Execution): void {
      stmts.updateExecution.run(e.status, e.started_at, e.ended_at, e.exit_code, e.id);
    },
    getExecution(id: string): Execution | null {
      const row = stmts.getExecution.get(id);
      if (row === undefined) {
        return null;
      }
      return rowToExecution(row);
    },
    listOpenExecutions(): Execution[] {
      const rows = stmts.listOpenExecutions.all();
      return rows.map(rowToExecution);
    },
    closeOpenExecutions(status: ExecutionStatus, endedAt: number): number {
      const result = stmts.closeOpenExecutions.run(status, endedAt);
      return Number(result.changes);
    },
    listExecutionsByTask(taskId: string, limit: number): Execution[] {
      const rows = stmts.listExecutionsByTask.all(taskId, limit);
      return rows.map(rowToExecution);
    },
    listRecentExecutions(limit: number): Execution[] {
      const rows = stmts.listRecentExecutions.all(limit);
      return rows.map(rowToExecution);
    },

    close(): void {
      db.close();
    },
  };
}
