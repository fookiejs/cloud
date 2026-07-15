import type { WorkflowStageRow } from "../db/workflow-db.js";
import { listWorkflowStageRows } from "../db/workflow-db.js";
import {
  collectSpawnableTemplates,
  type TemplateSpawnContext,
} from "../domain/task-template-graph.js";
import { isWorkDone } from "../domain/work-status.js";
import { listEpicWorkflowTasks, type BridgeTask } from "../domain/task.js";
import {
  resolveStageTaskTemplateRoots,
  stageHasActionableTemplates,
  type StageTaskTemplate,
} from "../domain/workflow-stage.js";
import { emptyToNull } from "../lib/strings.js";
import { mutateTaskRow } from "../db/tasks-db.js";
import {
  applyWorkflowStateNodeToTaskInput,
  linkSpawnedTemplateTask,
  loadEpicWorkflowState,
  spawnContextFromWorkflowState,
  syncTaskIntoWorkflowState,
} from "./workflow-state-service.js";
import { computeEpicStageId } from "./epic-service.js";
import { allocateTaskId, listBridgeTasks, upsertBridgeTask } from "./task-service.js";
import { pickMemberByProjectRole } from "./workflow-service.js";

function buildSpawnContext(
  stageRow: WorkflowStageRow,
  workflowTasks: BridgeTask[],
  stageRows: WorkflowStageRow[],
  epicId: number,
): TemplateSpawnContext {
  const state = loadEpicWorkflowState(epicId);
  let activeStageId: string | null;
  if (state !== null && state.stageId !== null) {
    activeStageId = state.stageId;
  } else {
    activeStageId = computeEpicStageId(stageRows, workflowTasks);
  }
  let activeStage = stageRow;
  for (const stage of stageRows) {
    if (stage.id === activeStageId) {
      activeStage = stage;
      break;
    }
  }
  let spawnedTemplateIds: Set<string>;
  let doneTemplateIds: Set<string>;
  if (state) {
    const fromState = spawnContextFromWorkflowState(state);
    spawnedTemplateIds = fromState.spawnedTemplateIds;
    doneTemplateIds = fromState.doneTemplateIds;
  } else {
    spawnedTemplateIds = new Set(
      workflowTasks
        .map((task) => task.templateId)
        .filter((templateId): templateId is string => Boolean(templateId)),
    );
    doneTemplateIds = new Set(
      workflowTasks
        .filter((task) => task.templateId !== null && isWorkDone(task))
        .map((task) => task.templateId as string),
    );
  }

  return {
    stageId: stageRow.id,
    stagePosition: stageRow.position,
    activeStagePosition: activeStage.position,
    spawnedTemplateIds,
    doneTemplateIds,
  };
}

function spawnTemplateTask(input: {
  epic: BridgeTask;
  stageRow: WorkflowStageRow;
  template: {
    id: string;
    title: string;
    description: string | null;
    assigneeRole: string | null;
  };
  parentTaskId: number;
}): BridgeTask {
  const templateRole = emptyToNull(input.template.assigneeRole);
  const stageRole = emptyToNull(input.stageRow.auto_assign_role);
  let assigneeRole: string | null;
  if (templateRole !== null) {
    assigneeRole = templateRole;
  } else {
    assigneeRole = stageRole;
  }
  let assignee: string | null;
  if (assigneeRole !== null) {
    assignee = pickMemberByProjectRole(input.epic.projectId, assigneeRole);
  } else {
    assignee = null;
  }

  const id = allocateTaskId();
  let description: string;
  if (input.template.description !== null) {
    description = input.template.description;
  } else {
    description = "";
  }
  const nodeDefaults = applyWorkflowStateNodeToTaskInput(input.epic.id, input.template.id, {
    workStatus: "todo",
    comments: [],
  });
  const task = upsertBridgeTask({
    id,
    projectId: input.epic.projectId,
    projectName: input.epic.projectName,
    title: input.template.title,
    description,
    createdBy: "workflow",
    createdAt: null,
    parentId: input.parentTaskId,
    epicId: input.epic.id,
    templateId: input.template.id,
    stageId: input.stageRow.id,
    assignee,
    assigneeRole,
    assigneeKind: null,
    workStatus: nodeDefaults.workStatus,
  });
  if (nodeDefaults.comments.length > 0 || nodeDefaults.workStatus !== "todo") {
    mutateTaskRow(id, (row) => {
      row.comments = nodeDefaults.comments.slice();
      row.workStatus = nodeDefaults.workStatus;
    });
  }
  linkSpawnedTemplateTask(input.epic.id, input.template.id, id);
  const refreshed = listBridgeTasks().find((entry) => entry.id === id);
  if (refreshed) {
    syncTaskIntoWorkflowState(refreshed);
    return refreshed;
  }
  return task;
}

function resolveParentTaskId(
  epic: BridgeTask,
  workflowTasks: BridgeTask[],
  templateParentId: string | null,
): number {
  if (!templateParentId) return epic.id;
  for (const task of workflowTasks) {
    if (task.templateId === templateParentId) {
      return task.id;
    }
  }
  return epic.id;
}

function findTemplateParentId(
  nodes: StageTaskTemplate[],
  templateId: string,
  parentTemplateId: string | null = null,
): string | null {
  for (const node of nodes) {
    if (node.id === templateId) return parentTemplateId;
    if (node.children.length > 0) {
      const nextParent = node.id;
      const found = findTemplateParentId(node.children, templateId, nextParent);
      if (found !== null) return found;
    }
  }
  return null;
}

export function spawnUnlockedWorkflowTasks(epic: BridgeTask): BridgeTask[] {
  if (epic.parentId !== null) return [];

  const rows = listWorkflowStageRows({ projectId: epic.projectId, stageId: "" }).sort((a, b) => a.position - b.position);
  const allTasks = listBridgeTasks();
  const workflowTasks = listEpicWorkflowTasks(allTasks, epic.id);
  const created: BridgeTask[] = [];

  for (const row of rows) {
    const templateInput = {
      taskTemplatesJson: row.task_templates_json,
      stageId: row.id,
      stageTitle: row.title,
    };
    if (!stageHasActionableTemplates(templateInput)) continue;

    const roots = resolveStageTaskTemplateRoots(templateInput);
    const ctx = buildSpawnContext(row, workflowTasks.concat(created), rows, epic.id);
    let progressed = true;
    while (progressed) {
      progressed = false;
      const spawnable = collectSpawnableTemplates(roots, ctx);
      for (const template of spawnable) {
        const templateParentId = findTemplateParentId(roots, template.id);
        const parentTaskId = resolveParentTaskId(
          epic,
          workflowTasks.concat(created),
          templateParentId,
        );
        const task = spawnTemplateTask({
          epic,
          stageRow: row,
          template: {
            id: template.id,
            title: template.title,
            description: template.description,
            assigneeRole: template.assigneeRole,
          },
          parentTaskId,
        });
        created.push(task);
        ctx.spawnedTemplateIds.add(template.id);
        progressed = true;
      }
    }
  }

  return created;
}

export function spawnEpicWorkflowGraph(epic: BridgeTask): BridgeTask[] {
  return spawnUnlockedWorkflowTasks(epic);
}
