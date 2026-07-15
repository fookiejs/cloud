import { getProjectsDb } from "./projects-db.js";

export type WorkflowStageRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  purpose: string;
  rules_json: string;
  position: number;
  auto_assign: number;
  auto_assign_role: string;
  layout_x: number | null;
  layout_y: number | null;
  spawn_task_count: number;
  task_templates_json: string;
  roles_json: string;
};

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  name: string;
  available: number;
  stage_roles_json: string;
  role: string;
};

export type ProjectWorkflowSettingsRow = {
  project_id: string;
  roles_json: string;
};

export function migrateWorkflowTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_stages (
      id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      rules_json TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      auto_assign INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id)
    );

    CREATE INDEX IF NOT EXISTS idx_project_members_project
      ON project_members(project_id);

    CREATE TABLE IF NOT EXISTS project_workflow_settings (
      project_id TEXT NOT NULL PRIMARY KEY,
      roles_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const columns = db.prepare("PRAGMA table_info(workflow_stages)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("layout_x")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN layout_x REAL");
  }
  if (!names.has("layout_y")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN layout_y REAL");
  }
  if (!names.has("spawn_task_count")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN spawn_task_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.has("task_templates_json")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN task_templates_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!names.has("roles_json")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN roles_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!names.has("auto_assign_role")) {
    db.exec("ALTER TABLE workflow_stages ADD COLUMN auto_assign_role TEXT NOT NULL DEFAULT ''");
  }

  const memberColumns = db.prepare("PRAGMA table_info(project_members)").all() as { name: string }[];
  const memberNames = new Set(memberColumns.map((column) => column.name));
  if (!memberNames.has("stage_roles_json")) {
    db.exec("ALTER TABLE project_members ADD COLUMN stage_roles_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!memberNames.has("role")) {
    db.exec("ALTER TABLE project_members ADD COLUMN role TEXT NOT NULL DEFAULT ''");
  }
  if (!memberNames.has("actor_kind")) {
    db.exec("ALTER TABLE project_members ADD COLUMN actor_kind TEXT NOT NULL DEFAULT ''");
  }
  db.exec("UPDATE project_members SET actor_kind = '' WHERE actor_kind = 'human'");

  db.exec("DELETE FROM project_members WHERE role IS NULL OR trim(role) = ''");
  db.exec("DROP TABLE IF EXISTS project_decisions");
}

export function countWorkflowStages(projectId: string): number {
  migrateWorkflowTables();
  const row = getProjectsDb()
    .prepare("SELECT COUNT(*) AS count FROM workflow_stages WHERE project_id = ?")
    .get(projectId) as { count: number };
  return row.count;
}

export function listWorkflowStageRows(filter: {
  projectId: string;
  stageId: string;
}): WorkflowStageRow[] {
  migrateWorkflowTables();
  const projectId = filter.projectId;
  const stageId = filter.stageId;
  if (projectId !== "" && stageId !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, title, description, purpose, rules_json, position, auto_assign, auto_assign_role, layout_x, layout_y, spawn_task_count, task_templates_json, roles_json
         FROM workflow_stages WHERE project_id = ? AND id = ?`,
      )
      .all(projectId, stageId) as WorkflowStageRow[];
  }
  if (projectId !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, title, description, purpose, rules_json, position, auto_assign, auto_assign_role, layout_x, layout_y, spawn_task_count, task_templates_json, roles_json
         FROM workflow_stages WHERE project_id = ? ORDER BY position ASC, title COLLATE NOCASE ASC`,
      )
      .all(projectId) as WorkflowStageRow[];
  }
  return [];
}

export function deleteWorkflowStagesForProject(projectId: string) {
  migrateWorkflowTables();
  getProjectsDb()
    .prepare("DELETE FROM workflow_stages WHERE project_id = ?")
    .run(projectId);
}

export function insertWorkflowStageRow(row: {
  id: string;
  projectId: string;
  title: string;
  description: string;
  purpose: string;
  rulesJson: string;
  position: number;
  autoAssignRole: string;
  layoutX: number | null;
  layoutY: number | null;
  spawnTaskCount: number;
  taskTemplatesJson: string;
}) {
  migrateWorkflowTables();
  const autoAssignRole = row.autoAssignRole;
  let autoAssignFlag = 0;
  if (autoAssignRole) {
    autoAssignFlag = 1;
  }
  getProjectsDb()
    .prepare(
      `INSERT INTO workflow_stages
        (id, project_id, title, description, purpose, rules_json, position, auto_assign, auto_assign_role, layout_x, layout_y, spawn_task_count, task_templates_json, roles_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', datetime('now'))`,
    )
    .run(
      row.id,
      row.projectId,
      row.title,
      row.description,
      row.purpose,
      row.rulesJson,
      row.position,
      autoAssignFlag,
      autoAssignRole,
      row.layoutX,
      row.layoutY,
      row.spawnTaskCount,
      row.taskTemplatesJson,
    );
}

export function listProjectMemberRows(filter: {
  projectId: string;
  id: string;
}): ProjectMemberRow[] {
  migrateWorkflowTables();
  const projectId = filter.projectId;
  const id = filter.id;
  if (id !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, name, available, stage_roles_json, role FROM project_members WHERE id = ?`,
      )
      .all(id) as ProjectMemberRow[];
  }
  if (projectId !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, name, available, stage_roles_json, role FROM project_members WHERE project_id = ? ORDER BY name COLLATE NOCASE ASC`,
      )
      .all(projectId) as ProjectMemberRow[];
  }
  return [];
}

export function insertProjectMemberRow(row: {
  id: string;
  projectId: string;
  name: string;
  role: string;
}) {
  migrateWorkflowTables();
  getProjectsDb()
    .prepare(
      `INSERT INTO project_members (id, project_id, name, available, stage_roles_json, role, updated_at)
       VALUES (?, ?, ?, 1, '{}', ?, datetime('now'))`,
    )
    .run(
      row.id,
      row.projectId,
      row.name,
      row.role,
    );
}

export function updateProjectMemberRow(
  id: string,
  patch: { name: string | null; role: string | null },
): boolean {
  migrateWorkflowTables();
  const existingRows = listProjectMemberRows({ projectId: "", id });
  if (existingRows.length === 0) return false;
  const existing = existingRows[0];
  if (!existing) return false;
  let name = existing.name;
  if (patch.name !== null) {
    name = patch.name;
  }
  let role = existing.role;
  if (patch.role !== null) {
    role = patch.role;
  }
  const result = getProjectsDb()
    .prepare(
      `UPDATE project_members SET name = ?, role = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(name, role, id);
  return result.changes > 0;
}

export function listProjectWorkflowSettingsRows(filter: {
  projectId: string;
}): ProjectWorkflowSettingsRow[] {
  migrateWorkflowTables();
  const projectId = filter.projectId;
  if (projectId === "") return [];
  return getProjectsDb()
    .prepare(
      `SELECT project_id, roles_json FROM project_workflow_settings WHERE project_id = ?`,
    )
    .all(projectId) as ProjectWorkflowSettingsRow[];
}

export function upsertProjectWorkflowSettingsRow(projectId: string, rolesJson: string) {
  migrateWorkflowTables();
  getProjectsDb()
    .prepare(
      `INSERT INTO project_workflow_settings (project_id, roles_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(project_id) DO UPDATE SET
         roles_json = excluded.roles_json,
         updated_at = datetime('now')`,
    )
    .run(projectId, rolesJson);
}

export function deleteProjectMemberRow(id: string): boolean {
  migrateWorkflowTables();
  const result = getProjectsDb()
    .prepare("DELETE FROM project_members WHERE id = ?")
    .run(id);
  return result.changes > 0;
}
