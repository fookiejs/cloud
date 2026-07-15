import type { StageTaskTemplate } from "./workflow-stage.js";

export type TemplateSpawnContext = {
  stageId: string;
  stagePosition: number;
  activeStagePosition: number;
  spawnedTemplateIds: Set<string>;
  doneTemplateIds: Set<string>;
};

export function flattenTemplateNodes(
  nodes: StageTaskTemplate[],
): StageTaskTemplate[] {
  const result: StageTaskTemplate[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      for (const child of flattenTemplateNodes(node.children)) {
        result.push(child);
      }
    }
  }
  return result;
}

export function countSpawnableTemplates(nodes: StageTaskTemplate[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children.length > 0) {
      count += countSpawnableTemplates(node.children);
    }
  }
  return count;
}

function dependenciesMet(
  node: StageTaskTemplate,
  ctx: TemplateSpawnContext,
): boolean {
  return node.dependsOn.every((templateId) => ctx.doneTemplateIds.has(templateId));
}

function stageIsReachable(ctx: TemplateSpawnContext): boolean {
  return ctx.stagePosition <= ctx.activeStagePosition;
}

export function collectSpawnableTemplates(
  nodes: StageTaskTemplate[],
  ctx: TemplateSpawnContext,
): StageTaskTemplate[] {
  if (!stageIsReachable(ctx)) return [];

  const result: StageTaskTemplate[] = [];
  for (const node of nodes) {
    if (!node) continue;

    if (!dependenciesMet(node, ctx)) continue;

    if (!ctx.spawnedTemplateIds.has(node.id)) {
      result.push(node);
      continue;
    }

    if (node.children.length > 0) {
      if (!ctx.doneTemplateIds.has(node.id)) continue;
      for (const child of collectSpawnableTemplates(node.children, ctx)) {
        result.push(child);
      }
    }
  }

  return result;
}

export function collectSiblingTemplateIds(
  nodes: StageTaskTemplate[],
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.children.length > 0) {
      for (const childId of collectSiblingTemplateIds(node.children)) {
        ids.push(childId);
      }
    }
  }
  return ids;
}
