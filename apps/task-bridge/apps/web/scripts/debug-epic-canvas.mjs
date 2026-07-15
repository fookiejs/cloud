import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const taskRes = await fetch("http://localhost:3000/tasks/136", {
  headers: { "x-api-key": "dev-key" },
});
const task = await taskRes.json();
const workflowRes = await fetch("http://localhost:3000/projects/task-bridge/workflow", {
  headers: { "x-api-key": "dev-key" },
});
const workflow = await workflowRes.json();

const epicId = 136;
const epicStageId = task.stageId;
const subtasks = task.subtasks ?? [];
const stages = workflow.stages ?? [];

function toRuntime(subtask) {
  const workStatus = subtask.workStatus ?? (subtask.done ? "done" : "todo");
  return { taskId: subtask.taskId, workStatus, workStatusLabel: subtask.workStatusLabel ?? workStatus };
}

function buildStatusLookup(subtasks, stageId) {
  const byTemplateId = new Map();
  for (const subtask of subtasks) {
    if (subtask.stageId !== stageId) continue;
    if (!subtask.templateId) continue;
    byTemplateId.set(subtask.templateId, toRuntime(subtask));
  }
  return byTemplateId;
}

function runtimeForTemplate(templateId, stageId, subtasks, statusByTemplateId) {
  const mapped = statusByTemplateId.get(templateId);
  if (mapped) return mapped;
  const subtask = subtasks.find((e) => e.templateId === templateId && e.stageId === stageId);
  return subtask ? toRuntime(subtask) : null;
}

function sanitizeStageTemplates(nodes) {
  return (nodes ?? []).flatMap((node) => {
    if (node.kind === "group") return (node.children ?? []).map((c) => ({ ...c, kind: "task" }));
    return [{ ...node, kind: "task" }];
  });
}

function collectTemplatePlacedTaskIds(templates, stageId, subtasks, statusByTemplateId) {
  const ids = new Set();
  function walk(nodes) {
    for (const node of nodes) {
      const runtime = runtimeForTemplate(node.id, stageId, subtasks, statusByTemplateId);
      if (runtime) ids.add(runtime.taskId);
      if (node.children?.length) walk(sanitizeStageTemplates(node.children));
    }
  }
  walk(templates);
  return ids;
}

const renderedTaskIds = new Set();
const report = [];

for (const stage of stages.sort((a, b) => a.position - b.position)) {
  const templates = sanitizeStageTemplates(stage.taskTemplates ?? []);
  const statusByTemplateId = buildStatusLookup(subtasks, stage.id);
  for (const subtask of subtasks) {
    if (subtask.stageId !== stage.id || !subtask.templateId) continue;
    if (!statusByTemplateId.has(subtask.templateId)) {
      statusByTemplateId.set(subtask.templateId, toRuntime(subtask));
    }
  }
  const templatePlacedTaskIds = collectTemplatePlacedTaskIds(
    templates,
    stage.id,
    subtasks,
    statusByTemplateId,
  );
  const hasTemplates = templates.length > 0;
  const hasStageSubtasks = subtasks.some((e) => e.stageId === stage.id);
  const hasTasks = hasTemplates || hasStageSubtasks;

  const treeNodes = [];
  for (const template of templates) {
    const runtime = runtimeForTemplate(template.id, stage.id, subtasks, statusByTemplateId);
    const duplicate = runtime ? renderedTaskIds.has(runtime.taskId) : false;
    if (runtime && !duplicate) renderedTaskIds.add(runtime.taskId);
    treeNodes.push({
      templateId: template.id,
      title: template.title,
      runtime: runtime?.taskId ?? null,
      duplicate,
      visible: !duplicate,
    });
  }

  const remaining = subtasks.filter(
    (e) => e.stageId === stage.id && !renderedTaskIds.has(e.taskId),
  );
  for (const r of remaining) renderedTaskIds.add(r.taskId);

  report.push({
    stageId: stage.id,
    title: stage.title,
    templateCount: templates.length,
    hasTasks,
    statusLookup: [...statusByTemplateId.entries()].map(([k, v]) => ({ templateId: k, taskId: v.taskId })),
    templatePlacedTaskIds: [...templatePlacedTaskIds],
    treeNodes,
    remainingAfterStage: remaining.map((r) => r.taskId),
    renderedSoFar: [...renderedTaskIds],
  });
}

console.log(JSON.stringify({ epicId, epicStageId, subtaskCount: subtasks.length, subtasks, report }, null, 2));
