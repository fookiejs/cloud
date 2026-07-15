export type StageTaskTemplate = {
  id: string;
  title: string;
  description: string;
  assigneeRole: string | null;
  dependsOn: string[];
  children: StageTaskTemplate[];
};

export const SUBTASK_SPAWN_STAGE_ID = "in-progress";

type TemplateScalar = string | number | boolean | null;

type TemplateJsonRow = {
  id: TemplateScalar | null;
  title: TemplateScalar | null;
  description: TemplateScalar | null;
  assigneeRole: TemplateScalar | null;
  dependsOn: TemplateScalar[] | null;
  children: TemplateJsonRow[] | null;
};

function isStringRecord(value: object | null): value is Record<string, TemplateScalar> {
  return value !== null && value instanceof Object && !Array.isArray(value);
}

export function parseStageRolesJson(
  raw: string | null,
): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, TemplateScalar>;
    if (!isStringRecord(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const valueStr = value as string;
      if (
        value !== null &&
        String(valueStr) === valueStr &&
        valueStr
      ) {
        result[key] = valueStr;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeStageRolesJson(roles: Record<string, string>): string {
  return JSON.stringify(roles);
}

export function parseRulesJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as TemplateScalar[];
    if (!Array.isArray(parsed)) return [];
    const result: string[] = [];
    for (const item of parsed) {
      if (
        item !== null &&
        String(item) === item &&
        item.length > 0
      ) {
        result.push(item);
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function resolveEpicDescription(input: {
  description: string;
  purpose: string;
  rulesJson: string;
}): string {
  const parts: string[] = [];
  const description = input.description;
  const purpose = input.purpose;
  if (description) parts.push(description);
  if (purpose && purpose !== description) parts.push(purpose);
  const rules = parseRulesJson(input.rulesJson);
  if (rules.length > 0) parts.push(rules.join("\n\n"));
  return parts.join("\n\n");
}

function resolveTaskDescription(row: TemplateJsonRow): string {
  const descCandidate = row.description as string;
  if (row.description !== null && String(descCandidate) === descCandidate) {
    return descCandidate;
  }
  return "";
}

function parseTemplateNode(
  item: TemplateJsonRow,
  index: number,
  fallbackTitle: string,
): StageTaskTemplate | null {
  let id: string;
  const idCandidate = item.id as string;
  if (item.id !== null && String(idCandidate) === idCandidate && idCandidate) {
    id = idCandidate;
  } else {
    id = `tpl-${index}`;
  }
  let title: string;
  const titleCandidate = item.title as string;
  if (item.title !== null && String(titleCandidate) === titleCandidate) {
    title = titleCandidate;
  } else {
    title = "";
  }
  if (!title) return null;
  const template: StageTaskTemplate = {
    id,
    title: title || fallbackTitle,
    description: resolveTaskDescription(item),
    assigneeRole: null,
    dependsOn: [],
    children: [],
  };
  const assigneeRoleCandidate = item.assigneeRole as string;
  if (
    item.assigneeRole !== null &&
    String(assigneeRoleCandidate) === assigneeRoleCandidate &&
    assigneeRoleCandidate
  ) {
    template.assigneeRole = assigneeRoleCandidate;
  }
  if (Array.isArray(item.dependsOn)) {
    const deps: string[] = [];
    for (const entry of item.dependsOn) {
      if (
        entry !== null &&
        String(entry) === entry &&
        entry.length > 0
      ) {
        deps.push(entry);
      }
    }
    template.dependsOn = deps;
  }
  if (Array.isArray(item.children)) {
    template.children = parseTaskTemplateNodes(item.children, "Task");
  }
  return template;
}

function parseTaskTemplateNodes(
  raw: TemplateJsonRow[],
  fallbackTitle: string,
): StageTaskTemplate[] {
  const result: StageTaskTemplate[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const node = raw[i];
    if (!node) continue;
    const parsed = parseTemplateNode(node, i, fallbackTitle);
    if (parsed !== null) result.push(parsed);
  }
  return result;
}

export function parseTaskTemplatesJson(
  raw: string | null,
): StageTaskTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TemplateJsonRow[];
    if (!Array.isArray(parsed)) return [];
    return parseTaskTemplateNodes(parsed, "Task");
  } catch {
    return [];
  }
}

function serializeTemplateNode(
  template: StageTaskTemplate,
): TemplateJsonRow {
  let assigneeRole: TemplateScalar | null = null;
  if (template.assigneeRole) {
    assigneeRole = template.assigneeRole;
  }
  let children: TemplateJsonRow[] | null = null;
  if (template.children.length > 0) {
    children = template.children.map((child) =>
      serializeTemplateNode(child),
    );
  }
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    assigneeRole,
    dependsOn: template.dependsOn,
    children,
  };
}

export function serializeTaskTemplates(templates: StageTaskTemplate[]): string {
  return JSON.stringify(
    templates.map((template) => serializeTemplateNode(template)),
  );
}

export function resolveStageTaskTemplates(input: {
  taskTemplatesJson: string | null;
  stageId: string;
  stageTitle: string;
}): StageTaskTemplate[] {
  return parseTaskTemplatesJson(input.taskTemplatesJson);
}

export function resolveStageTaskTemplateRoots(input: {
  taskTemplatesJson: string | null;
  stageId: string;
  stageTitle: string;
}): StageTaskTemplate[] {
  return resolveStageTaskTemplates(input);
}

function templateTreeHasTasks(nodes: StageTaskTemplate[]): boolean {
  return nodes.some((node) => node.title.length > 0);
}

export function stageHasActionableTemplates(input: {
  taskTemplatesJson: string | null;
  stageId: string;
  stageTitle: string;
}): boolean {
  const roots = resolveStageTaskTemplateRoots(input);
  return templateTreeHasTasks(roots);
}

export function countSpawnableTemplates(
  templates: StageTaskTemplate[],
): number {
  let count = 0;
  for (const node of templates) {
    count += 1;
    if (node.children.length > 0) {
      count += countSpawnableTemplates(node.children);
    }
  }
  return count;
}
