import type { StageTaskTemplate } from "@/lib/api";

export const NODE_ADD_BTN_SIZE = 28;

function createTaskTemplate(stageTitle: string, index: number): StageTaskTemplate {
  let title = `${stageTitle} task ${index + 1}`;
  if (index === 0) {
    title = "New task";
  }
  return {
    id: `task-${crypto.randomUUID()}`,
    title,
    description: "",
    assigneeRole: null,
    dependsOn: [],
    children: [],
  };
}

export function sanitizeTaskNode(node: StageTaskTemplate): StageTaskTemplate {
  const children = node.children.map(sanitizeTaskNode);
  let description = node.description;
  if (description === null) {
    description = "";
  }
  let assigneeRole = node.assigneeRole;
  if (assigneeRole === null) {
    assigneeRole = null;
  }
  let dependsOn = node.dependsOn;
  if (dependsOn === null) {
    dependsOn = [];
  }
  return {
    id: node.id,
    title: node.title,
    description,
    assigneeRole,
    dependsOn,
    children,
  };
}

export function sanitizeStageTemplates(nodes: StageTaskTemplate[]): StageTaskTemplate[] {
  return nodes.map(sanitizeTaskNode);
}

export function flattenTemplates(nodes: StageTaskTemplate[]): StageTaskTemplate[] {
  const result: StageTaskTemplate[] = [];
  for (const node of sanitizeStageTemplates(nodes)) {
    result.push(node);
    if (node.children.length > 0) {
      for (const child of flattenTemplates(node.children)) {
        result.push(child);
      }
    }
  }
  return result;
}

export function countSpawnableTemplates(nodes: StageTaskTemplate[]): number {
  return flattenTemplates(nodes).length;
}

export function patchTemplateInTree(
  nodes: StageTaskTemplate[],
  templateId: string,
  patch: Partial<StageTaskTemplate>,
): StageTaskTemplate[] {
  return nodes.map((node) => {
    if (node.id === templateId) {
      return sanitizeTaskNode(Object.assign({}, node, patch));
    }
    if (node.children.length === 0) return node;
    return Object.assign({}, node, {
      children: patchTemplateInTree(node.children, templateId, patch),
    });
  });
}

export function removeTemplateFromTree(nodes: StageTaskTemplate[], templateId: string): StageTaskTemplate[] {
  return sanitizeStageTemplates(
    nodes
      .filter((node) => node.id !== templateId)
      .map((node) => {
        if (node.children.length > 0) {
          return Object.assign({}, node, { children: removeTemplateFromTree(node.children, templateId) });
        }
        return node;
      }),
  );
}

export function addChildTemplate(
  nodes: StageTaskTemplate[],
  parentId: string,
  child: StageTaskTemplate,
): StageTaskTemplate[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return sanitizeTaskNode(
        Object.assign({}, node, {
          children: node.children.concat([sanitizeTaskNode(child)]),
        }),
      );
    }
    if (node.children.length === 0) return node;
    return Object.assign({}, node, { children: addChildTemplate(node.children, parentId, child) });
  });
}

export function createStageTaskTemplate(stageTitle: string, index: number): StageTaskTemplate {
  return sanitizeTaskNode(createTaskTemplate(stageTitle, index));
}

export function createSubtaskTemplate(parentTitle: string, index: number): StageTaskTemplate {
  let title = `${parentTitle} subtask ${index + 1}`;
  if (index === 0) {
    title = `${parentTitle} subtask`;
  }
  return sanitizeTaskNode({
    id: `task-${crypto.randomUUID()}`,
    title,
    description: "",
    assigneeRole: null,
    dependsOn: [],
    children: [],
  });
}

export type TemplateSiblingLocation = {
  parentId: string | null;
  index: number;
  siblingCount: number;
};

export function findTemplateSiblingLocation(
  nodes: StageTaskTemplate[],
  templateId: string,
  parentId: string | null = null,
): TemplateSiblingLocation | null {
  const siblings = sanitizeStageTemplates(nodes);
  for (let index = 0; index < siblings.length; index += 1) {
    const node = siblings[index];
    if (!node) continue;
    if (node.id === templateId) {
      return { parentId, index, siblingCount: siblings.length };
    }
    if (node.children.length > 0) {
      const found = findTemplateSiblingLocation(node.children, templateId, node.id);
      if (found) return found;
    }
  }
  return null;
}

export function canMoveTemplateAmongSiblings(
  nodes: StageTaskTemplate[],
  templateId: string,
  delta: -1 | 1,
): boolean {
  const location = findTemplateSiblingLocation(nodes, templateId);
  if (!location) return false;
  const target = location.index + delta;
  return target >= 0 && target < location.siblingCount;
}

function swapSiblingInTree(
  nodes: StageTaskTemplate[],
  parentId: string | null,
  index: number,
  delta: -1 | 1,
): StageTaskTemplate[] {
  const target = index + delta;
  if (parentId === null) {
    const roots = sanitizeStageTemplates(nodes);
    if (target < 0 || target >= roots.length) return nodes;
    const next = roots.slice();
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return nodes;
    next[index] = swap;
    next[target] = current;
    return next;
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      const children = sanitizeStageTemplates(node.children);
      if (target < 0 || target >= children.length) return node;
      const next = children.slice();
      const current = next[index];
      const swap = next[target];
      if (!current || !swap) return node;
      next[index] = swap;
      next[target] = current;
      return sanitizeTaskNode(Object.assign({}, node, { children: next }));
    }
    if (node.children.length === 0) return node;
    return Object.assign({}, node, { children: swapSiblingInTree(node.children, parentId, index, delta) });
  });
}

export function moveTemplateAmongSiblings(
  nodes: StageTaskTemplate[],
  templateId: string,
  delta: -1 | 1,
): StageTaskTemplate[] {
  const location = findTemplateSiblingLocation(nodes, templateId);
  if (!location || !canMoveTemplateAmongSiblings(nodes, templateId, delta)) return nodes;
  return swapSiblingInTree(nodes, location.parentId, location.index, delta);
}

export function findTemplateInTree(
  nodes: StageTaskTemplate[],
  templateId: string,
  depth = 0,
): { template: StageTaskTemplate; depth: number } | null {
  for (const node of sanitizeStageTemplates(nodes)) {
    if (node.id === templateId) return { template: node, depth };
    if (node.children.length > 0) {
      const found = findTemplateInTree(node.children, templateId, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export type DisplayTemplate = {
  template: StageTaskTemplate;
  depth: number;
};

export function flattenTemplatesForDisplay(
  nodes: StageTaskTemplate[],
  depth = 0,
): DisplayTemplate[] {
  const result: DisplayTemplate[] = [];
  for (const node of sanitizeStageTemplates(nodes)) {
    result.push({ template: node, depth });
    if (node.children.length > 0) {
      for (const row of flattenTemplatesForDisplay(node.children, depth + 1)) {
        result.push(row);
      }
    }
  }
  return result;
}

export function countDisplayRows(nodes: StageTaskTemplate[]): number {
  const roots = sanitizeStageTemplates(nodes);
  let count = 1;
  for (const node of roots) {
    count += countSubtreeRows(node);
  }
  return count;
}

function countSubtreeRows(node: StageTaskTemplate): number {
  const children = node.children;
  if (children.length === 0) return 1;
  let count = 1;
  for (const child of children) {
    count += countSubtreeRows(child);
  }
  return count + 1;
}

const TASK_ROW_HEIGHT = 40;
const TASK_ROW_GAP = 8;

function stackHeightForSiblings(nodes: StageTaskTemplate[]): number {
  const siblings = sanitizeStageTemplates(nodes);
  if (siblings.length === 0) return 0;
  return siblings.reduce((total, node, index) => {
    let gap = 0;
    if (index > 0) {
      gap = TASK_ROW_GAP;
    }
    return total + gap + subtreeStackHeight(node);
  }, 0);
}

function subtreeStackHeight(node: StageTaskTemplate): number {
  const children = sanitizeStageTemplates(node.children);
  const childStack = stackHeightForSiblings(children);
  if (childStack === 0) return TASK_ROW_HEIGHT;
  return TASK_ROW_HEIGHT + TASK_ROW_GAP + childStack;
}

export function templateStackHeight(nodes: StageTaskTemplate[]): number {
  return stackHeightForSiblings(nodes);
}
