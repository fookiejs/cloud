import { getProjectsDb } from "./projects-db.js";
import {
  parseWorkflowStateData,
  serializeWorkflowStateData,
  type EpicWorkflowStateData,
} from "../domain/workflow-state.js";

export type EpicRow = {
  id: number;
  project_id: string;
  title: string;
  description: string;
  stage_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowStateRow = {
  id: number;
  epic_id: number;
  state_json: string;
  updated_at: string;
};

export function migrateEpicWorkflowTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      stage_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);

    CREATE TABLE IF NOT EXISTS workflow_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epic_id INTEGER NOT NULL UNIQUE,
      state_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (epic_id) REFERENCES epics(id)
    );
  `);
}

export function listEpicRows(filter: { id: number; projectId: string }): EpicRow[] {
  migrateEpicWorkflowTables();
  const db = getProjectsDb();
  const id = filter.id;
  const projectId = filter.projectId;
  if (id > 0) {
    return db.prepare("SELECT * FROM epics WHERE id = ?").all(id) as EpicRow[];
  }
  if (projectId !== "") {
    return db
      .prepare("SELECT * FROM epics WHERE project_id = ? ORDER BY updated_at DESC")
      .all(projectId) as EpicRow[];
  }
  return db.prepare("SELECT * FROM epics ORDER BY updated_at DESC").all() as EpicRow[];
}

export function insertEpicRow(input: {
  id: number;
  projectId: string;
  title: string;
  description: string;
  stageId: string | null;
  createdBy: string;
}): EpicRow {
  migrateEpicWorkflowTables();
  const db = getProjectsDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO epics (id, project_id, title, description, stage_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.projectId,
    input.title,
    input.description,
    input.stageId,
    input.createdBy || "system",
    now,
    now,
  );
  const rows = listEpicRows({ id: input.id, projectId: "" });
  const row = rows[0];
  if (!row) throw new Error("Failed to insert epic");
  return row;
}

export function updateEpicStageRow(epicId: number, stageId: string | null): void {
  migrateEpicWorkflowTables();
  getProjectsDb()
    .prepare(
      `UPDATE epics SET stage_id = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(stageId, epicId);
}

export function updateEpicSpecRow(
  epicId: number,
  input: { title: string | null; description: string | null },
): void {
  migrateEpicWorkflowTables();
  const rows = listEpicRows({ id: epicId, projectId: "" });
  if (rows.length === 0) return;
  const row = rows[0];
  if (!row) return;
  let title = row.title;
  if (input.title !== null) title = input.title;
  let description = row.description;
  if (input.description !== null) description = input.description;
  getProjectsDb()
    .prepare(
      `UPDATE epics SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(title, description, epicId);
}

export function listWorkflowStateRows(filter: { epicId: number }): WorkflowStateRow[] {
  migrateEpicWorkflowTables();
  const db = getProjectsDb();
  if (filter.epicId > 0) {
    return db
      .prepare("SELECT * FROM workflow_state WHERE epic_id = ?")
      .all(filter.epicId) as WorkflowStateRow[];
  }
  return db.prepare("SELECT * FROM workflow_state ORDER BY epic_id ASC").all() as WorkflowStateRow[];
}

export function getEpicWorkflowStateData(epicId: number): EpicWorkflowStateData | null {
  const rows = listWorkflowStateRows({ epicId });
  const row = rows[0];
  if (!row) return null;
  return parseWorkflowStateData(row.state_json);
}

export function insertWorkflowStateRow(epicId: number, data: EpicWorkflowStateData): WorkflowStateRow {
  migrateEpicWorkflowTables();
  const db = getProjectsDb();
  const payload = serializeWorkflowStateData(data);
  db.prepare(
    `INSERT INTO workflow_state (epic_id, state_json, updated_at) VALUES (?, ?, datetime('now'))`,
  ).run(epicId, payload);
  const rows = listWorkflowStateRows({ epicId });
  const row = rows[0];
  if (!row) throw new Error("Failed to insert workflow state");
  return row;
}

export function saveEpicWorkflowStateData(
  epicId: number,
  data: EpicWorkflowStateData,
): EpicWorkflowStateData {
  migrateEpicWorkflowTables();
  const payload = serializeWorkflowStateData(data);
  const db = getProjectsDb();
  const existing = listWorkflowStateRows({ epicId });
  if (existing.length === 0) {
    insertWorkflowStateRow(epicId, data);
    return data;
  }
  db.prepare(
    `UPDATE workflow_state SET state_json = ?, updated_at = datetime('now') WHERE epic_id = ?`,
  ).run(payload, epicId);
  return data;
}

export function mutateEpicWorkflowState(
  epicId: number,
  mutator: (data: EpicWorkflowStateData) => void,
): EpicWorkflowStateData | null {
  const data = getEpicWorkflowStateData(epicId);
  if (!data) return null;
  mutator(data);
  return saveEpicWorkflowStateData(epicId, data);
}
