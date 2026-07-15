import type { TaskComment } from "./task.js";
import type { WorkStatus } from "./work-status.js";
import {
  resolveStageTaskTemplateRoots,
  type StageTaskTemplate,
} from "./workflow-stage.js";

export type WorkflowStateNode = {
  templateId: string;
  stageId: string;
  parentTemplateId: string | null;
  title: string;
  description: string;
  assigneeRole: string | null;
  workStatus: WorkStatus;
  comments: TaskComment[];
  taskId: number | null;
};

export type EpicWorkflowStateData = {
  stageId: string | null;
  nodes: Record<string, WorkflowStateNode>;
};

export type WorkflowStateNodeSummary = {
  templateId: string;
  stageId: string;
  parentTemplateId: string | null;
  title: string;
  taskId: number | null;
  workStatus: WorkStatus;
  commentCount: number;
};

function walkTemplateNodes(
  nodes: StageTaskTemplate[],
  stageId: string,
  parentTemplateId: string | null,
  out: Record<string, WorkflowStateNode>,
): void {
  for (const node of nodes) {
    out[node.id] = {
      templateId: node.id,
      stageId,
      parentTemplateId,
      title: node.title,
      description: node.description,
      assigneeRole: node.assigneeRole,
      workStatus: "todo",
      comments: [],
      taskId: null,
    };
    let children: StageTaskTemplate[];
    if (node.children !== null) {
      children = node.children;
    } else {
      children = [];
    }
    if (children.length > 0) {
      walkTemplateNodes(children, stageId, node.id, out);
    }
  }
}

export function buildInitialWorkflowState(input: {
  stageId: string | null;
  stages: {
    id: string;
    taskTemplatesJson: string | null;
    title: string;
  }[];
}): EpicWorkflowStateData {
  const nodes: Record<string, WorkflowStateNode> = {};
  for (const stage of input.stages) {
    const roots = resolveStageTaskTemplateRoots({
      taskTemplatesJson: stage.taskTemplatesJson,
      stageId: stage.id,
      stageTitle: stage.title,
    });
    walkTemplateNodes(roots, stage.id, null, nodes);
  }
  return {
    stageId: input.stageId,
    nodes,
  };
}

export function parseWorkflowStateData(raw: string | null): EpicWorkflowStateData | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as EpicWorkflowStateData;
    if (!row.nodes || !(row.nodes instanceof Object) || Array.isArray(row.nodes)) return null;
    const nodes = row.nodes;
    let stageId: string | null = null;
    if (row.stageId !== null && String(row.stageId) === row.stageId) {
      stageId = row.stageId || null;
    }
    return { stageId, nodes };
  } catch {
    return null;
  }
}

export function serializeWorkflowStateData(data: EpicWorkflowStateData): string {
  return JSON.stringify(data);
}

export function summarizeWorkflowStateNodes(
  data: EpicWorkflowStateData,
): WorkflowStateNodeSummary[] {
  return Object.values(data.nodes).map((node) => ({
    templateId: node.templateId,
    stageId: node.stageId,
    parentTemplateId: node.parentTemplateId,
    title: node.title,
    taskId: node.taskId,
    workStatus: node.workStatus,
    commentCount: node.comments.length,
  }));
}
