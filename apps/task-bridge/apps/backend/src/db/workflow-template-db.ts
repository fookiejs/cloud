import { countSpawnableTemplates } from "../domain/task-template-graph.js";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";
import type { StageTaskTemplate } from "../domain/workflow-stage.js";
import { serializeTaskTemplates } from "../domain/workflow-stage.js";
import { listProjectRows, getProjectsDb } from "./projects-db.js";
import {
  deleteWorkflowStagesForProject,
  insertWorkflowStageRow,
} from "./workflow-db.js";

export type WorkflowTemplateRow = {
  id: string;
  title: string;
  description: string;
  owner_user_id: string | null;
  updated_at: string;
};

export type WorkflowTemplateStageRow = {
  template_id: string;
  id: string;
  title: string;
  description: string;
  purpose: string;
  rules_json: string;
  position: number;
  auto_assign: number;
  layout_x: number | null;
  layout_y: number | null;
  spawn_task_count: number;
  task_templates_json: string;
};

type TemplateStageSeed = {
  id: string;
  title: string;
  description: string;
  purpose: string;
  rules: string[];
  position: number;
  autoAssign: boolean;
  taskTemplates: StageTaskTemplate[] | null;
};

type TemplateSeed = {
  id: string;
  title: string;
  description: string;
  stages: TemplateStageSeed[];
};

const DEPRECATED_TEMPLATE_IDS = [
  "empty",
  "ai-sdlc",
  "go",
  "nodejs",
  "sdlc-classic",
  "scrum-sprint",
  "devops-cicd",
  "agentic-engineering",
  "senior-team",
  "software-team",
  "spec-review-gate",
  "plan-decompose",
  "ready-for-pr",
  "review-security",
  "general-work",
  "lean-sdlc",
];

function task(
  id: string,
  title: string,
  description = "",
  assigneeRole = "",
  children: StageTaskTemplate[] = [],
  dependsOn: string[] = [],
): StageTaskTemplate {
  return {
    id,
    title,
    description,
    assigneeRole: assigneeRole || null,
    dependsOn,
    children,
  };
}

const DEFAULT_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    id: DEFAULT_WORKFLOW_TEMPLATE_ID,
    title: "Do the work",
    description: "One stage. One task. The epic text is the job.",
    stages: [
      {
        id: "do",
        title: "Do",
        description: "Execute the epic.",
        purpose: "Work",
        rules: [
          "Epic done",
          "Comments, brief, completion summaries, and Notes must match the epic Objective language. Workflow UI labels may stay English.",
        ],
        position: 0,
        autoAssign: false,
        taskTemplates: [
          task(
            "do-work",
            "Do the work",
            "Match the language of the epic Objective for comments, brief, completion, and Notes. UI/workflow labels may stay English.",
          ),
        ],
      },
    ],
  },
];

function removeDeprecatedTemplates() {
  migrateWorkflowTemplateTables();
  const db = getProjectsDb();
  db.prepare(
    "UPDATE projects SET workflow_template_id = ? WHERE workflow_template_id = 'empty'",
  ).run(DEFAULT_WORKFLOW_TEMPLATE_ID);
  for (const id of DEPRECATED_TEMPLATE_IDS) {
    db.prepare(
      "UPDATE projects SET workflow_template_id = ? WHERE workflow_template_id = ?",
    ).run(DEFAULT_WORKFLOW_TEMPLATE_ID, id);
    deleteWorkflowTemplateStages(id);
    db.prepare("DELETE FROM workflow_templates WHERE id = ?").run(id);
  }
}

let didSyncProjectStages = false;

function syncProjectStagesFromDefaultTemplate() {
  migrateWorkflowTemplateTables();
  const db = getProjectsDb();
  db.prepare("UPDATE projects SET workflow_template_id = ?").run(
    DEFAULT_WORKFLOW_TEMPLATE_ID,
  );
  const templateStages = listWorkflowTemplateStageRows(DEFAULT_WORKFLOW_TEMPLATE_ID);
  for (const project of listProjectRows()) {
    deleteWorkflowStagesForProject(project.id);
    for (const stage of templateStages) {
      insertWorkflowStageRow({
        id: stage.id,
        projectId: project.id,
        title: stage.title,
        description: stage.description,
        purpose: stage.purpose,
        rulesJson: stage.rules_json,
        position: stage.position,
        autoAssignRole: "",
        layoutX: stage.layout_x,
        layoutY: stage.layout_y,
        spawnTaskCount: stage.spawn_task_count,
        taskTemplatesJson: stage.task_templates_json,
      });
    }
  }
}

function insertTemplateStages(template: TemplateSeed) {
  for (const stage of template.stages) {
    let taskTemplates: StageTaskTemplate[] = [];
    if (stage.taskTemplates !== null) {
      taskTemplates = stage.taskTemplates;
    }
    insertWorkflowTemplateStageRow({
      templateId: template.id,
      id: stage.id,
      title: stage.title,
      description: stage.description,
      purpose: stage.purpose,
      rulesJson: JSON.stringify(stage.rules),
      position: stage.position,
      autoAssign: stage.autoAssign,
      spawnTaskCount: countSpawnableTemplates(taskTemplates),
      taskTemplatesJson: serializeTaskTemplates(taskTemplates),
      layoutX: null,
      layoutY: null,
    });
  }
}

function upsertBuiltinTemplate(template: TemplateSeed) {
  if (template.id === DEFAULT_WORKFLOW_TEMPLATE_ID) {
    const existing = listWorkflowTemplateRows({ id: template.id });
    if (existing.length > 0) {
      deleteWorkflowTemplateStages(template.id);
      getProjectsDb()
        .prepare("UPDATE workflow_templates SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?")
        .run(template.title, template.description, template.id);
    } else {
      insertWorkflowTemplateRow({
        id: template.id,
        title: template.title,
        description: template.description,
      });
    }
    insertTemplateStages(template);
    return;
  }
  const existing = listWorkflowTemplateRows({ id: template.id });
  if (existing.length > 0) return;
  insertWorkflowTemplateRow({
    id: template.id,
    title: template.title,
    description: template.description,
  });
  insertTemplateStages(template);
}

export function migrateWorkflowTemplateTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_template_stages (
      template_id TEXT NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      rules_json TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      auto_assign INTEGER NOT NULL DEFAULT 0,
      layout_x REAL,
      layout_y REAL,
      spawn_task_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (template_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_template_stages_template
      ON workflow_template_stages(template_id);
  `);

  const columns = db.prepare("PRAGMA table_info(workflow_template_stages)").all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("task_templates_json")) {
    db.exec("ALTER TABLE workflow_template_stages ADD COLUMN task_templates_json TEXT NOT NULL DEFAULT '[]'");
  }
  const templateColumns = db.prepare("PRAGMA table_info(workflow_templates)").all() as { name: string }[];
  const templateNames = new Set(templateColumns.map((column) => column.name));
  if (!templateNames.has("owner_user_id")) {
    db.exec("ALTER TABLE workflow_templates ADD COLUMN owner_user_id TEXT");
  }
}

export function countWorkflowTemplates(): number {
  migrateWorkflowTemplateTables();
  const row = getProjectsDb()
    .prepare("SELECT COUNT(*) AS count FROM workflow_templates")
    .get() as { count: number };
  return row.count;
}

export function listWorkflowTemplateRows(filter: { id: string }): WorkflowTemplateRow[] {
  migrateWorkflowTemplateTables();
  const id = filter.id;
  if (id !== "") {
    return getProjectsDb()
      .prepare(
        "SELECT id, title, description, owner_user_id, updated_at FROM workflow_templates WHERE id = ?",
      )
      .all(id) as WorkflowTemplateRow[];
  }
  return getProjectsDb()
    .prepare(
      "SELECT id, title, description, owner_user_id, updated_at FROM workflow_templates ORDER BY title COLLATE NOCASE ASC",
    )
    .all() as WorkflowTemplateRow[];
}

export function listWorkflowTemplateRowsForOwner(ownerUserId: string): WorkflowTemplateRow[] {
  migrateWorkflowTemplateTables();
  return getProjectsDb()
    .prepare(
      `SELECT id, title, description, owner_user_id, updated_at
       FROM workflow_templates
       WHERE owner_user_id = ?
       ORDER BY title COLLATE NOCASE ASC`,
    )
    .all(ownerUserId) as WorkflowTemplateRow[];
}

export function getWorkflowTemplateOwner(templateId: string): string | null {
  migrateWorkflowTemplateTables();
  const row = getProjectsDb()
    .prepare("SELECT owner_user_id FROM workflow_templates WHERE id = ?")
    .get(templateId) as { owner_user_id: string | null } | undefined;
  return row?.owner_user_id ?? null;
}

export function setWorkflowTemplateOwner(templateId: string, ownerUserId: string) {
  migrateWorkflowTemplateTables();
  getProjectsDb()
    .prepare("UPDATE workflow_templates SET owner_user_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(ownerUserId, templateId);
}

export function listWorkflowTemplateStageRows(templateId: string): WorkflowTemplateStageRow[] {
  migrateWorkflowTemplateTables();
  return getProjectsDb()
    .prepare(
      `SELECT template_id, id, title, description, purpose, rules_json, position, auto_assign, layout_x, layout_y, spawn_task_count, task_templates_json
       FROM workflow_template_stages WHERE template_id = ? ORDER BY position ASC, title COLLATE NOCASE ASC`,
    )
    .all(templateId) as WorkflowTemplateStageRow[];
}

export function deleteWorkflowTemplateStages(templateId: string) {
  migrateWorkflowTemplateTables();
  getProjectsDb()
    .prepare("DELETE FROM workflow_template_stages WHERE template_id = ?")
    .run(templateId);
}

export function deleteWorkflowTemplateRow(templateId: string): boolean {
  migrateWorkflowTemplateTables();
  const id = templateId;
  deleteWorkflowTemplateStages(id);
  const result = getProjectsDb().prepare("DELETE FROM workflow_templates WHERE id = ?").run(id);
  return result.changes > 0;
}

export function insertWorkflowTemplateRow(row: {
  id: string;
  title: string;
  description: string;
  ownerUserId?: string | null;
}) {
  migrateWorkflowTemplateTables();
  const ownerUserId = row.ownerUserId ?? null;
  getProjectsDb()
    .prepare(
      `INSERT INTO workflow_templates (id, title, description, owner_user_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(row.id, row.title, row.description, ownerUserId);
}

export function insertWorkflowTemplateStageRow(row: {
  templateId: string;
  id: string;
  title: string;
  description: string;
  purpose: string;
  rulesJson: string;
  position: number;
  autoAssign: boolean;
  layoutX: number | null;
  layoutY: number | null;
  spawnTaskCount: number;
  taskTemplatesJson: string;
}) {
  migrateWorkflowTemplateTables();
  let autoAssignFlag = 0;
  if (row.autoAssign) {
    autoAssignFlag = 1;
  }
  getProjectsDb()
    .prepare(
      `INSERT INTO workflow_template_stages
        (template_id, id, title, description, purpose, rules_json, position, auto_assign, layout_x, layout_y, spawn_task_count, task_templates_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      row.templateId,
      row.id,
      row.title,
      row.description,
      row.purpose,
      row.rulesJson,
      row.position,
      autoAssignFlag,
      row.layoutX,
      row.layoutY,
      row.spawnTaskCount,
      row.taskTemplatesJson,
    );
}

export { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";

export function seedDefaultWorkflowTemplates() {
  migrateWorkflowTemplateTables();
  removeDeprecatedTemplates();
  for (const template of DEFAULT_TEMPLATE_SEEDS) {
    upsertBuiltinTemplate(template);
  }
  if (!didSyncProjectStages) {
    didSyncProjectStages = true;
    syncProjectStagesFromDefaultTemplate();
  }
}
