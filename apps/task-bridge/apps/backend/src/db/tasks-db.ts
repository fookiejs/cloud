import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import {
  DONE_STAGE_ID,
  sortTasks,
  type BridgeTask,
} from "../domain/task.js";
import { isWorkStatus, type WorkStatus } from "../domain/work-status.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveDatabasePath(): string {
  if (config.databasePath) return config.databasePath;
  return join(moduleDir, "..", "..", "..", "..", "data", "bridge.db");
}
let db: Database.Database | null = null;

type TaskSqliteCell = string | number | bigint | Uint8Array | null;

type TaskSqliteRow = Record<string, TaskSqliteCell>;

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      parent_id INTEGER,
      epic_id INTEGER,
      template_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT,
      labels_json TEXT NOT NULL DEFAULT '[]',
      assignee TEXT,
      assignee_role TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      claimed_by TEXT,
      claimed_at TEXT,
      answered_by TEXT,
      answered_at TEXT,
      answer TEXT,
      stage_id TEXT,
      work_status TEXT,
      comments_json TEXT NOT NULL DEFAULT '[]',
      events_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_stage_id ON tasks(stage_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
  `);
  const columns = database
    .prepare("PRAGMA table_info(tasks)")
    .all() as { name: string }[];
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("brief")) {
    database.exec("ALTER TABLE tasks ADD COLUMN brief TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("agent_metadata_json")) {
    database.exec(
      "ALTER TABLE tasks ADD COLUMN agent_metadata_json TEXT NOT NULL DEFAULT '{}'",
    );
  }
}

function rowToTask(row: TaskSqliteRow): BridgeTask {
  let parentId: number | null = null;
  if (row.parent_id !== null) {
    parentId = Number(row.parent_id);
  }

  let epicId: number | null = null;
  if (row.epic_id !== null) {
    epicId = Number(row.epic_id);
  }

  let templateId: string | null = null;
  if (row.template_id !== null) {
    const rawTemplateId: string | number = row.template_id as string | number;
    templateId = String(rawTemplateId) || null;
  }

  let priority: string | null = null;
  if (row.priority !== null) {
    const rawPriority: string | number = row.priority as string | number;
    priority = String(rawPriority) || null;
  }

  let assignee = "";
  if (row.assignee !== null) {
    const rawAssignee: string | number = row.assignee as string | number;
    assignee = String(rawAssignee);
  }
  if (!assignee && row.created_by !== null) {
    assignee = String(row.created_by);
  }
  if (!assignee) {
    assignee = "unassigned";
  }

  let assigneeRole: string | null = null;
  if (row.assignee_role !== null) {
    const rawAssigneeRole: string | number = row.assignee_role as string | number;
    assigneeRole = String(rawAssigneeRole) || null;
  }

  let claimedBy: string | null = null;
  if (row.claimed_by !== null) {
    const rawClaimedBy: string | number = row.claimed_by as string | number;
    claimedBy = String(rawClaimedBy) || null;
  }

  let claimedAt: string | null = null;
  if (row.claimed_at !== null) {
    const rawClaimedAt: string | number = row.claimed_at as string | number;
    claimedAt = String(rawClaimedAt);
  }

  let answeredBy: string | null = null;
  if (row.answered_by !== null) {
    const rawAnsweredBy: string | number = row.answered_by as string | number;
    answeredBy = String(rawAnsweredBy) || null;
  }

  let answeredAt: string | null = null;
  if (row.answered_at !== null) {
    const rawAnsweredAt: string | number = row.answered_at as string | number;
    answeredAt = String(rawAnsweredAt);
  }

  let answer: string | null = null;
  if (row.answer !== null) {
    const rawAnswer: string | number = row.answer as string | number;
    answer = String(rawAnswer) || null;
  }

  let stageId: string | null = null;
  if (row.stage_id !== null) {
    const rawStageId: string | number = row.stage_id as string | number;
    stageId = String(rawStageId) || null;
  }

  let workStatus: WorkStatus | null = null;
  if (isWorkStatus(row.work_status as string)) {
    workStatus = row.work_status as WorkStatus;
  }

  let brief = "";
  if (row.brief !== null && row.brief !== undefined) {
    brief = String(row.brief);
  }

  let agentMetadata: BridgeTask["agentMetadata"] = {};
  const rawMeta = row.agent_metadata_json;
  if (rawMeta !== null && rawMeta !== undefined) {
    try {
      agentMetadata = JSON.parse(String(rawMeta)) as BridgeTask["agentMetadata"];
    } catch {
      agentMetadata = {};
    }
  }

  return {
    id: Number(row.id),
    projectId: String(row.project_id),
    projectName: String(row.project_name),
    parentId,
    epicId,
    templateId,
    title: String(row.title),
    description: String(row.description),
    acceptanceCriteria: null,
    priority,
    labels: JSON.parse(String(row.labels_json)) as string[],
    assignee,
    assigneeRole,
    assigneeKind: null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    claimedBy,
    claimedAt,
    answeredBy,
    answeredAt,
    answer,
    stageId,
    workStatus,
    brief,
    agentMetadata,
    comments: JSON.parse(String(row.comments_json)) as BridgeTask["comments"],
    events: JSON.parse(String(row.events_json)) as BridgeTask["events"],
  };
}

function taskToRow(task: BridgeTask): TaskSqliteRow {
  return {
    id: task.id,
    project_id: task.projectId,
    project_name: task.projectName,
    parent_id: task.parentId,
    epic_id: task.epicId,
    template_id: task.templateId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    labels_json: JSON.stringify(task.labels),
    assignee: task.assignee,
    assignee_role: task.assigneeRole,
    created_by: task.createdBy,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    claimed_by: task.claimedBy,
    claimed_at: task.claimedAt,
    answered_by: task.answeredBy,
    answered_at: task.answeredAt,
    answer: task.answer,
    stage_id: task.stageId,
    work_status: task.workStatus,
    brief: task.brief,
    agent_metadata_json: JSON.stringify(task.agentMetadata),
    comments_json: JSON.stringify(task.comments),
    events_json: JSON.stringify(task.events),
  };
}

export function getTasksDb(): Database.Database {
  if (db) return db;
  const path = resolveDatabasePath();
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

export function deleteEpicSubtasks(epicId: number): void {
  const database = getTasksDb();
  database
    .prepare("DELETE FROM tasks WHERE epic_id = ? AND id != ?")
    .run(epicId, epicId);
}

export function deleteTaskRows(ids: number[]): void {
  if (ids.length === 0) return;
  const database = getTasksDb();
  const statement = database.prepare("DELETE FROM tasks WHERE id = ?");
  for (const id of ids) {
    statement.run(id);
  }
}

export function countActiveTasksOnStage(
  projectId: string,
  stageId: string,
): number {
  const database = getTasksDb();
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count FROM tasks
       WHERE project_id = ? AND stage_id = ? AND stage_id != ?`,
    )
    .get(projectId, stageId, DONE_STAGE_ID) as { count: number };
  return row.count;
}

export function listTaskRows(filter: { id: number }): BridgeTask[] {
  const database = getTasksDb();
  if (filter.id > 0) {
    const rows = database.prepare("SELECT * FROM tasks WHERE id = ?").all(filter.id);
    return rows.map((row) => rowToTask(row as TaskSqliteRow));
  }
  const rows = database
    .prepare("SELECT * FROM tasks ORDER BY updated_at DESC, id DESC")
    .all();
  return sortTasks(
    rows.map((row) => rowToTask(row as TaskSqliteRow)),
  );
}

export function allocateTaskRowId(): number {
  const database = getTasksDb();
  const row = database.prepare("SELECT MAX(id) AS maxId FROM tasks").get() as {
    maxId: number | null;
  };
  let base = 0;
  if (row.maxId !== null) {
    base = row.maxId;
  }
  return base + 1;
}

export function upsertTaskRow(task: BridgeTask): void {
  const database = getTasksDb();
  const row = taskToRow(task);
  database
    .prepare(
      `
      INSERT INTO tasks (
        id, project_id, project_name, parent_id, epic_id, template_id, title, description, priority, labels_json,
        assignee, assignee_role, created_by, created_at, updated_at, claimed_by,
        claimed_at, answered_by, answered_at, answer, stage_id, work_status, brief, agent_metadata_json, comments_json, events_json
      ) VALUES (
        @id, @project_id, @project_name, @parent_id, @epic_id, @template_id, @title, @description, @priority, @labels_json,
        @assignee, @assignee_role, @created_by, @created_at, @updated_at, @claimed_by,
        @claimed_at, @answered_by, @answered_at, @answer, @stage_id, @work_status, @brief, @agent_metadata_json, @comments_json, @events_json
      )
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        project_name = excluded.project_name,
        parent_id = excluded.parent_id,
        epic_id = excluded.epic_id,
        template_id = excluded.template_id,
        title = excluded.title,
        description = excluded.description,
        priority = excluded.priority,
        labels_json = excluded.labels_json,
        assignee = excluded.assignee,
        assignee_role = excluded.assignee_role,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        claimed_by = excluded.claimed_by,
        claimed_at = excluded.claimed_at,
        answered_by = excluded.answered_by,
        answered_at = excluded.answered_at,
        answer = excluded.answer,
        stage_id = excluded.stage_id,
        work_status = excluded.work_status,
        brief = excluded.brief,
        agent_metadata_json = excluded.agent_metadata_json,
        comments_json = excluded.comments_json,
        events_json = excluded.events_json
    `,
    )
    .run(row);
}

export function mutateTaskRow(
  id: number,
  mutator: (task: BridgeTask) => void,
): BridgeTask | null {
  const database = getTasksDb();
  return database.transaction(() => {
    const tasks = listTaskRows({ id });
    if (tasks.length === 0) return null;
    const task = tasks[0];
    if (!task) return null;
    mutator(task);
    upsertTaskRow(task);
    return task;
  })();
}
