import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";

export type ProjectRow = {
  id: string;
  name: string;
  repo_path: string;
  description: string;
  workflow_template_id: string;
  owner_user_id: string | null;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveDatabasePath(): string {
  if (config.databasePath) return config.databasePath;
  return join(moduleDir, "..", "..", "..", "..", "data", "bridge.db");
}

let db: Database.Database | null = null;

function columnExists(database: Database.Database, table: string, column: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'read-write',
      is_system_admin INTEGER NOT NULL DEFAULT 0,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  if (!columnExists(database, "projects", "description")) {
    database.exec("ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(database, "projects", "workflow_template_id")) {
    database.exec(
      `ALTER TABLE projects ADD COLUMN workflow_template_id TEXT NOT NULL DEFAULT '${DEFAULT_WORKFLOW_TEMPLATE_ID}'`,
    );
  }
  if (!columnExists(database, "users", "must_change_password")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columnExists(database, "projects", "owner_user_id")) {
    database.exec("ALTER TABLE projects ADD COLUMN owner_user_id TEXT");
  }
  database
    .prepare(
      `UPDATE projects SET workflow_template_id = ? WHERE trim(workflow_template_id) = ''`,
    )
    .run(DEFAULT_WORKFLOW_TEMPLATE_ID);
  database
    .prepare(
      "UPDATE projects SET workflow_template_id = ? WHERE workflow_template_id = 'empty'",
    )
    .run(DEFAULT_WORKFLOW_TEMPLATE_ID);
}

export function getProjectsDb(): Database.Database {
  if (db) return db;
  const path = resolveDatabasePath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

export function countProjects(): number {
  const row = getProjectsDb()
    .prepare("SELECT COUNT(*) AS count FROM projects")
    .get() as { count: number };
  return row.count;
}

export function listProjectRows(): ProjectRow[] {
  return getProjectsDb()
    .prepare(
      "SELECT id, name, repo_path, description, workflow_template_id, owner_user_id FROM projects ORDER BY name COLLATE NOCASE",
    )
    .all() as ProjectRow[];
}

export function listProjectRowsForOwner(ownerUserId: string): ProjectRow[] {
  return getProjectsDb()
    .prepare(
      `SELECT id, name, repo_path, description, workflow_template_id, owner_user_id
       FROM projects
       WHERE owner_user_id = ?
       ORDER BY name COLLATE NOCASE`,
    )
    .all(ownerUserId) as ProjectRow[];
}

export function listProjectRowsById(id: string): ProjectRow[] {
  if (id === "") return [];
  return getProjectsDb()
    .prepare(
      "SELECT id, name, repo_path, description, workflow_template_id, owner_user_id FROM projects WHERE id = ?",
    )
    .all(id) as ProjectRow[];
}

export function insertProjectRow(
  id: string,
  name: string,
  description = "",
  workflowTemplateId = DEFAULT_WORKFLOW_TEMPLATE_ID,
  ownerUserId: string | null = null,
): boolean {
  try {
    getProjectsDb()
      .prepare(
        `INSERT INTO projects (id, name, repo_path, description, workflow_template_id, owner_user_id, updated_at)
         VALUES (?, ?, '', ?, ?, ?, datetime('now'))`,
      )
      .run(id, name || id, description, workflowTemplateId, ownerUserId);
    return true;
  } catch {
    return false;
  }
}

export function updateProjectRow(
  id: string,
  input: {
    name: string;
    description: string;
    workflowTemplateId: string;
  },
): boolean {
  if (listProjectRowsById(id).length === 0) return false;
  const result = getProjectsDb()
    .prepare(
      `UPDATE projects SET name = ?, description = ?, workflow_template_id = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(
      input.name,
      input.description,
      input.workflowTemplateId,
      id,
    );
  return result.changes > 0;
}
