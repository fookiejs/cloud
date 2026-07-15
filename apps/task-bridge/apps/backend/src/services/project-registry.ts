import {
  getProjectsDb,
  insertProjectRow,
  listProjectRows,
  listProjectRowsById,
  listProjectRowsForOwner,
  updateProjectRow,
} from "../db/projects-db.js";
import { migrateEpicWorkflowTables } from "../db/epic-workflow-db.js";
import {
  copyTemplateStagesToProject,
  ensureDefaultWorkflowTemplates,
} from "./workflow-template-service.js";
import { applyWorkflowTemplateToProject } from "./workflow-service.js";
import {
  normalizeWorkflowTemplateId,
} from "../domain/workflow-template-id.js";
export type BridgeProject = {
  id: string;
  name: string;
  description: string;
  workflowTemplateId: string;
  ownerUserId: string | null;
};

export type BridgeProjectPublic = {
  id: string;
  name: string;
  description: string;
  workflowTemplateId: string;
};

export type CreateProjectInput = {
  name: string;
  id: string;
  description: string;
  workflowTemplateId: string;
};

export type UpdateProjectInput = {
  name: string;
  description: string;
  workflowTemplateId: string;
};

function rowToProject(row: {
  id: string;
  name: string;
  description: string;
  workflow_template_id: string;
  owner_user_id?: string | null;
}): BridgeProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workflowTemplateId: normalizeWorkflowTemplateId(row.workflow_template_id),
    ownerUserId: row.owner_user_id ?? null,
  };
}

function slugifyProjectId(name: string): string {
  const mapped = name
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i");
  return mapped
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initProjectRegistry(): void {
  getProjectsDb();
  migrateEpicWorkflowTables();
  ensureDefaultWorkflowTemplates();
}

export function refreshProjectRegistry(): BridgeProject[] {
  return listProjectRows().map(rowToProject);
}

export function listPublicProjects(ownerUserId?: string): BridgeProjectPublic[] {
  const rows =
    ownerUserId !== undefined && ownerUserId !== ""
      ? listProjectRowsForOwner(ownerUserId)
      : listProjectRows();
  return rows.map((row) => {
    const project = rowToProject(row);
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      workflowTemplateId: project.workflowTemplateId,
    };
  });
}

export function createProject(
  input: CreateProjectInput,
  ownerUserId?: string,
): BridgeProject | "duplicate" | null {
  const name = input.name.trim();
  if (!name) return null;
  const inputId = input.id;
  const id = inputId || slugifyProjectId(name);
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null;
  if (listProjectRowsById(id).length > 0) return "duplicate";
  const templateId = normalizeWorkflowTemplateId(input.workflowTemplateId);
  const description = input.description;
  const owner = ownerUserId ?? null;
  if (!insertProjectRow(id, name, description, templateId, owner)) {
    return "duplicate";
  }
  copyTemplateStagesToProject(id, templateId);
  const rows = listProjectRowsById(id);
  const row = rows[0];
  if (row) {
    return rowToProject(row);
  }
  return null;
}

export function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  ownerUserId?: string,
): BridgeProject | null {
  const existing = getProjectById(projectId, ownerUserId);
  if (!existing) return null;

  const name = input.name.trim();
  if (!name) return null;

  const description = input.description;
  const workflowTemplateId = normalizeWorkflowTemplateId(input.workflowTemplateId);
  const templateChanged = workflowTemplateId !== existing.workflowTemplateId;

  if (templateChanged) {
    applyWorkflowTemplateToProject(projectId, workflowTemplateId);
  }

  if (
    !updateProjectRow(projectId, {
      name,
      description,
      workflowTemplateId,
    })
  ) {
    return null;
  }

  return getProjectById(projectId, ownerUserId);
}

export function getProjectById(
  projectId: string,
  ownerUserId?: string,
): BridgeProject | null {
  const id = projectId;
  if (!id) return null;
  const rows = listProjectRowsById(id);
  const row = rows[0];
  if (!row) return null;
  const project = rowToProject(row);
  if (ownerUserId !== undefined && ownerUserId !== "") {
    if (project.ownerUserId === null || project.ownerUserId !== ownerUserId) {
      return null;
    }
  }
  return project;
}

export function userCanAccessProject(projectId: string, ownerUserId: string): boolean {
  return getProjectById(projectId, ownerUserId) !== null;
}

export function resetProjectRegistryCache(): void {}
