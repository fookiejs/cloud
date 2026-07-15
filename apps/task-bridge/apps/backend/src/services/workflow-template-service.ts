import {
  deleteWorkflowStagesForProject,
  insertWorkflowStageRow,
} from "../db/workflow-db.js";
import { randomUUID } from "node:crypto";
import {
  deleteWorkflowTemplateRow,
  deleteWorkflowTemplateStages,
  insertWorkflowTemplateRow,
  insertWorkflowTemplateStageRow,
  listWorkflowTemplateRows,
  listWorkflowTemplateRowsForOwner,
  listWorkflowTemplateStageRows,
  seedDefaultWorkflowTemplates,
  setWorkflowTemplateOwner,
  type WorkflowTemplateStageRow,
} from "../db/workflow-template-db.js";
import {
  resolveEpicDescription,
  resolveStageTaskTemplates,
  serializeTaskTemplates,
} from "../domain/workflow-stage.js";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";
import { AppError } from "../errors/app-error.js";
import { valueOrEmpty } from "../lib/strings.js";
import type { WorkflowStage } from "./workflow-service.js";

export type WorkflowTemplateSummary = {
  id: string;
  title: string;
  description: string;
};

export type WorkflowTemplate = WorkflowTemplateSummary & {
  stages: WorkflowStage[];
};

function layoutCoord(value: number | null): number | null {
  return value;
}

function templateStageRowToStage(row: WorkflowTemplateStageRow): WorkflowStage {
  const taskTemplates = resolveStageTaskTemplates({
    taskTemplatesJson: row.task_templates_json,
    stageId: row.id,
    stageTitle: row.title,
  });
  return {
    id: row.id,
    title: row.title,
    description: resolveEpicDescription({
      description: row.description,
      purpose: row.purpose,
      rulesJson: row.rules_json,
    }),
    position: row.position,
    autoAssignRole: null,
    layoutX: layoutCoord(row.layout_x),
    layoutY: layoutCoord(row.layout_y),
    spawnTaskCount: taskTemplates.length,
    taskTemplates,
    activeTaskCount: null,
  };
}

function slugify(value: string) {
  return value
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultTemplateStage(): WorkflowStage {
  return {
    id: `stage-${randomUUID()}`,
    title: "New epic",
    description: "",
    position: 0,
    autoAssignRole: null,
    layoutX: null,
    layoutY: null,
    spawnTaskCount: 0,
    taskTemplates: [],
    activeTaskCount: null,
  };
}

function resolveTemplateIdHint(id: string): string {
  return id.trim();
}

function stagePosition(stage: WorkflowStage, index: number): number {
  if (Number.isFinite(stage.position)) {
    return stage.position;
  }
  return index;
}

export function ensureDefaultWorkflowTemplates(): void {
  seedDefaultWorkflowTemplates();
}

export function createWorkflowTemplate(input: {
  id: string;
  title: string;
  description: string;
  ownerUserId?: string | null;
}): WorkflowTemplate {
  ensureDefaultWorkflowTemplates();
  const title = input.title;
  if (!title) {
    throw new AppError("Title is required", 400);
  }
  const idHint = resolveTemplateIdHint(input.id);
  const baseId = idHint || slugify(title) || `template-${randomUUID().slice(0, 8)}`;
  let id = baseId;
  let suffix = 2;
  while (listWorkflowTemplateRows({ id }).length > 0) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  insertWorkflowTemplateRow({
    id,
    title,
    description: valueOrEmpty(input.description),
    ownerUserId: input.ownerUserId ?? null,
  });
  return replaceWorkflowTemplate(id, [defaultTemplateStage()]);
}

export function listWorkflowTemplates(): WorkflowTemplateSummary[] {
  ensureDefaultWorkflowTemplates();
  return listWorkflowTemplateRows({ id: "" }).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
  }));
}

export function listOwnedWorkflowTemplates(ownerUserId: string): WorkflowTemplateSummary[] {
  ensureDefaultWorkflowTemplates();
  return listWorkflowTemplateRowsForOwner(ownerUserId).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
  }));
}

export function listAccessibleWorkflowTemplates(ownerUserId: string): WorkflowTemplateSummary[] {
  ensureDefaultWorkflowTemplates();
  const byId = new Map<string, WorkflowTemplateSummary>();
  for (const row of listWorkflowTemplateRows({ id: "" })) {
    if (row.owner_user_id !== null && row.owner_user_id !== ownerUserId) continue;
    byId.set(row.id, {
      id: row.id,
      title: row.title,
      description: row.description,
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

export function userCanReadWorkflowTemplate(templateId: string, ownerUserId: string): boolean {
  ensureDefaultWorkflowTemplates();
  const rows = listWorkflowTemplateRows({ id: templateId });
  const row = rows[0];
  if (!row) return false;
  return row.owner_user_id === null || row.owner_user_id === ownerUserId;
}

export function userCanMutateWorkflowTemplate(templateId: string, ownerUserId: string): boolean {
  ensureDefaultWorkflowTemplates();
  if (PROTECTED_WORKFLOW_TEMPLATE_IDS.has(templateId)) return false;
  const rows = listWorkflowTemplateRows({ id: templateId });
  const row = rows[0];
  if (!row) return false;
  return row.owner_user_id === ownerUserId;
}

export { setWorkflowTemplateOwner };

export function getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
  ensureDefaultWorkflowTemplates();
  const id = templateId;
  const rows = listWorkflowTemplateRows({ id });
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  if (!row) return null;
  const stages = listWorkflowTemplateStageRows(id).map(templateStageRowToStage);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    stages,
  };
}

export function replaceWorkflowTemplate(
  templateId: string,
  stages: WorkflowStage[],
): WorkflowTemplate {
  ensureDefaultWorkflowTemplates();
  const id = templateId;
  const templateRows = listWorkflowTemplateRows({ id });
  if (templateRows.length === 0) {
    throw new AppError("Workflow template not found", 404);
  }
  const row = templateRows[0];
  if (!row) throw new AppError("Workflow template not found", 404);
  deleteWorkflowTemplateStages(id);
  stages.forEach((stage, index) => {
    insertWorkflowTemplateStageRow({
      templateId: id,
      id: stage.id,
      title: stage.title,
      description: stage.description,
      purpose: "",
      rulesJson: "[]",
      position: stagePosition(stage, index),
      autoAssign: false,
      layoutX: stage.layoutX,
      layoutY: stage.layoutY,
      spawnTaskCount: stage.taskTemplates.length,
      taskTemplatesJson: serializeTaskTemplates(stage.taskTemplates),
    });
  });
  const updated = getWorkflowTemplate(id);
  if (!updated) {
    throw new AppError("Workflow template not found", 404);
  }
  return updated;
}

export function importWorkflowTemplate(input: {
  id: string;
  title: string;
  description: string;
  stages: WorkflowStage[];
  ownerUserId?: string | null;
}): WorkflowTemplate {
  ensureDefaultWorkflowTemplates();
  const title = input.title;
  if (!title) throw new AppError("Title is required", 400);

  const idHint = resolveTemplateIdHint(input.id);
  const baseId = idHint || slugify(title) || `template-${randomUUID().slice(0, 8)}`;
  let id = baseId;
  let suffix = 2;
  while (listWorkflowTemplateRows({ id }).length > 0) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  insertWorkflowTemplateRow({
    id,
    title,
    description: valueOrEmpty(input.description),
    ownerUserId: input.ownerUserId ?? null,
  });

  return replaceWorkflowTemplate(id, input.stages);
}

const PROTECTED_WORKFLOW_TEMPLATE_IDS = new Set([DEFAULT_WORKFLOW_TEMPLATE_ID, "lean-sdlc"]);

export function deleteWorkflowTemplate(templateId: string): void {
  ensureDefaultWorkflowTemplates();
  const id = templateId;
  if (PROTECTED_WORKFLOW_TEMPLATE_IDS.has(id)) {
    throw new AppError("Built-in template cannot be deleted", 403);
  }
  if (listWorkflowTemplateRows({ id }).length === 0) {
    throw new AppError("Workflow template not found", 404);
  }
  deleteWorkflowTemplateRow(id);
}

export function copyTemplateStagesToProject(projectId: string, templateId: string): WorkflowStage[] {
  const template = getWorkflowTemplate(templateId);
  if (!template) {
    throw new AppError("Workflow template not found", 404);
  }
  const id = projectId;
  deleteWorkflowStagesForProject(id);
  for (const stage of template.stages) {
    insertWorkflowStageRow({
      id: stage.id,
      projectId: id,
      title: stage.title,
      description: stage.description,
      purpose: "",
      rulesJson: "[]",
      position: stage.position,
      autoAssignRole: "",
      layoutX: stage.layoutX,
      layoutY: stage.layoutY,
      spawnTaskCount: stage.taskTemplates.length,
      taskTemplatesJson: serializeTaskTemplates(stage.taskTemplates),
    });
  }
  return template.stages;
}
