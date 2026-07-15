import type { Session } from "./session";
import { clearSession, loadSession, saveSession } from "./session";

export const DEFAULT_WORKFLOW_TEMPLATE_ID = "plan-build-deliver";

export type Project = {
  id: string;
  name: string;
  description: string;
  workflowTemplateId: string;
};

export type UpdateProjectInput = {
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

export type InboxItem = {
  taskId: number;
  title: string;
  preview: string | null;
  status: string;
  parentId: number | null;
  activityAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  projectId: string | null;
  projectName: string | null;
  assignee: string | null;
  stageId: string | null;
  stageTitle: string | null;
  commentCount: number;
};

export type AssigneeKind = "ai" | "";

export type StageTaskTemplate = {
  id: string;
  title: string;
  description: string;
  assigneeRole: string | null;
  dependsOn: string[];
  children: StageTaskTemplate[];
};

export type WorkflowStage = {
  id: string;
  title: string;
  description: string;
  position: number;
  autoAssignRole: string | null;
  layoutX: number | null;
  layoutY: number | null;
  spawnTaskCount: number;
  taskTemplates: StageTaskTemplate[];
  activeTaskCount: number | null;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  openTasks: number;
};

export type ProjectWorkflow = {
  projectId: string;
  roles: string[];
  stages: WorkflowStage[];
  members: ProjectMember[];
};

export type TaskStageSnapshot = {
  id: string;
  title: string;
  description: string;
  taskTemplates: StageTaskTemplate[];
};

export type InboxResult = {
  items: InboxItem[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type InboxQuery = {
  projectId: string | null;
  commentsOnly: boolean | null;
  epicsOnly: boolean | null;
  cursor: string | null;
  limit: number | null;
};

export type WorkStatus = "todo" | "in_progress" | "done";

export type TaskSubtask = {
  taskId: number;
  parentId: number | null;
  title: string;
  stageId: string | null;
  stageTitle: string | null;
  templateId: string | null;
  assignee: string | null;
  assigneeKind: AssigneeKind | null;
  claimedBy: string | null;
  workStatus: WorkStatus | null;
  workStatusLabel: string | null;
  done: boolean;
};

export type TaskComment = {
  id: string;
  role: "user" | "system";
  authorId: string;
  tags: string[];
  body: string;
  at: string;
  metadata: Record<string, string | number | boolean | null> | null;
  by: string;
  text: string;
};

export type WorkflowStateNode = {
  templateId: string;
  stageId: string;
  parentTemplateId: string | null;
  title: string;
  taskId: number | null;
  workStatus: WorkStatus;
  workStatusLabel: string;
  commentCount: number;
};

export type TaskDetail = {
  taskId: number;
  title: string;
  request: string;
  description: string;
  status: string;
  parentId: number | null;
  parent: { taskId: number; title: string; stageId: string | null } | null;
  subtasks: TaskSubtask[];
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  projectId: string | null;
  projectName: string | null;
  assignee: string | null;
  stageId: string | null;
  stage: TaskStageSnapshot | null;
  isEpic: boolean | null;
  workStatus: WorkStatus | null;
  workStatusLabel: string | null;
  comments: TaskComment[];
  libraryLinks: LibraryDocumentLink[];
  workflowState: WorkflowStateNode[];
};

export type LibrarySummary = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  documentCount: number;
};

export type LibraryDocumentSummary = {
  id: string;
  libraryId: string;
  title: string;
  description: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  extension: string;
  updatedAt: string;
  hasFile: boolean;
};

export type LibraryDetail = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  documents: LibraryDocumentSummary[];
};

export type LibraryDocument = LibraryDocumentSummary & {
  libraryTitle: string;
  projectId: string;
  linkCount: number;
};

export type LibraryDocumentLink = {
  documentId: string;
  documentTitle: string;
  libraryId: string;
  libraryTitle: string;
  taskId: number;
  linkedAt: string;
};

export type LibrarySyncItem = {
  id: string;
  projectId: string;
  libraryId: string;
  libraryTitle: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  extension: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSystemAdmin: boolean;
  createdAt: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeaders(session: Session): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${session.token}`,
  };
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as {
      error: string | null;
      details: { code: string | null } | null;
    };
    const details = body.details;
    if (details !== null && details.code === "PASSWORD_CHANGE_REQUIRED") {
      return "PASSWORD_CHANGE_REQUIRED";
    }
    if (body.error) return body.error;
  } catch {
    return response.statusText || "Request failed";
  }
  return response.statusText || "Request failed";
}

async function request<T>(
  session: Session,
  path: string,
  init: RequestInit | null = null,
): Promise<T> {
  let extraHeaders: HeadersInit = {};
  if (init !== null) {
    const headerValue = init.headers;
    if (typeof headerValue !== "undefined" && headerValue !== null) {
      extraHeaders = headerValue;
    }
  }
  let fetchInit: RequestInit = {};
  if (init !== null) {
    fetchInit = init;
  }
  const headers = Object.assign({}, authHeaders(session), extraHeaders);
  const response = await fetch(path, Object.assign({}, fetchInit, { headers }));

  if (response.status === 401) {
    clearSession();
    window.location.href = "/app/login";
    throw new ApiError("Session expired", 401);
  }

  if (!response.ok) {
    const message = await parseError(response);
    if (message === "PASSWORD_CHANGE_REQUIRED") {
      const current = loadSession();
      if (current) {
        saveSession(Object.assign({}, current, { mustChangePassword: true }));
      }
      window.location.href = "/app/change-password";
      throw new ApiError("Password change required", 403);
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) {
    return null as T;
  }
  const text = await response.text();
  if (!text) {
    return null as T;
  }
  return JSON.parse(text) as T;
}

export async function checkAuthStatus(): Promise<{ hasUsers: boolean; mode?: string }> {
  const response = await fetch("/api/auth/status");
  if (!response.ok) throw new ApiError("Failed to check status", response.status);
  return response.json() as Promise<{ hasUsers: boolean; mode?: string }>;
}

export async function fetchAuthMe(token: string): Promise<{
  id: string;
  name: string;
  email: string;
  role: string;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
}> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError("Failed to load user", response.status);
  return response.json() as Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
    isSystemAdmin: boolean;
    mustChangePassword: boolean;
  }>;
}

export async function setupAdmin(params: { name: string; email: string; password: string }) {
  const response = await fetch("/api/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error: string | null };
    let message = "Setup failed";
    if (body.error !== null) {
      message = body.error;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<Record<string, never>>;
}

export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<{
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isSystemAdmin: boolean;
    mustChangePassword: boolean;
  };
}> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error: string | null };
    let message = "Login failed";
    if (body.error !== null) {
      message = body.error;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<{
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      isSystemAdmin: boolean;
      mustChangePassword: boolean;
    };
  }>;
}

export async function changePassword(
  session: Session,
  params: { currentPassword: string; newPassword: string },
): Promise<{ user: { mustChangePassword: boolean } }> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error: string | null };
    let message = "Password change failed";
    if (body.error !== null) {
      message = body.error;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<{ user: { mustChangePassword: boolean } }>;
}

export function buildMobileQrData(session: Session): string {
  let server = "";
  if (typeof window !== "undefined") {
    server = window.location.origin;
  }
  return `taskbridge://auth?server=${encodeURIComponent(server)}&token=${encodeURIComponent(session.token)}`;
}

export async function fetchUsers(session: Session): Promise<PublicUser[]> {
  const data = await request<{ users: PublicUser[] }>(session, "/api/admin/users");
  if (data.users !== null) {
    return data.users;
  }
  return [];
}

export async function createAppUser(
  session: Session,
  params: { name: string; email: string; password: string; role: string },
): Promise<PublicUser> {
  const data = await request<{ user: PublicUser }>(session, "/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function updateAppUser(
  session: Session,
  userId: string,
  params: { name: string | null; role: string | null },
): Promise<PublicUser> {
  const data = await request<{ user: PublicUser }>(session, `/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function deleteAppUser(session: Session, userId: string): Promise<void> {
  await request<void>(session, `/api/admin/users/${userId}`, { method: "DELETE" });
}

export async function fetchProjects(session: Session) {
  const data = await request<{ projects: Project[] }>(session, "/api/projects");
  if (data.projects !== null) {
    return data.projects;
  }
  return [];
}

export type WorkflowTemplateSummary = {
  id: string;
  title: string;
  description: string;
};

export type WorkflowTemplate = WorkflowTemplateSummary & {
  stages: WorkflowStage[];
};

export async function createProject(session: Session, input: CreateProjectInput) {
  return request<Project>(session, "/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      id: input.id.trim(),
      description: input.description.trim(),
      workflowTemplateId: input.workflowTemplateId.trim() || DEFAULT_WORKFLOW_TEMPLATE_ID,
    }),
  });
}

export async function updateProject(session: Session, projectId: string, input: UpdateProjectInput) {
  return request<Project>(session, `/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchWorkflowTemplates(session: Session) {
  const data = await request<{ items: WorkflowTemplateSummary[] }>(
    session,
    "/api/workflow-templates",
  );
  if (data.items !== null) {
    return data.items;
  }
  return [];
}

export async function fetchWorkflowTemplate(session: Session, templateId: string) {
  return request<WorkflowTemplate>(session, `/api/workflow-templates/${templateId}`);
}

export async function createWorkflowTemplate(
  session: Session,
  input: { title: string; id: string; description: string },
) {
  return request<WorkflowTemplate>(session, "/api/workflow-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function saveWorkflowTemplate(
  session: Session,
  templateId: string,
  stages: WorkflowStage[],
) {
  return request<WorkflowTemplate>(session, `/api/workflow-templates/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stages }),
  });
}

export async function deleteWorkflowTemplate(session: Session, templateId: string) {
  await request<void>(session, `/api/workflow-templates/${templateId}`, {
    method: "DELETE",
  });
}

export const PROTECTED_WORKFLOW_TEMPLATE_IDS = new Set(["plan-build-deliver", "lean-sdlc"]);

export async function exportWorkflowTemplate(session: Session, templateId: string): Promise<void> {
  const res = await fetch(`/api/workflow-templates/${templateId}/export`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) throw new ApiError("Export failed", res.status);
  const blob = await res.blob();
  const dispositionHeader = res.headers.get("Content-Disposition");
  let disposition = "";
  if (dispositionHeader !== null) {
    disposition = dispositionHeader;
  }
  const match = /filename="([^"]+)"/.exec(disposition);
  let filename = `${templateId}.json`;
  if (match !== null && match.length > 1) {
    const captured = match[1];
    if (typeof captured === "string") {
      filename = captured;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type WorkflowExport = {
  projectId: string;
  roles: string[];
  stages: WorkflowStage[];
  members: ProjectMember[];
};

export async function importWorkflowTemplate(session: Session, data: WorkflowTemplate): Promise<WorkflowTemplate> {
  return request<WorkflowTemplate>(session, "/api/workflow-templates/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function applyWorkflowTemplate(
  session: Session,
  projectId: string,
  templateId: string,
) {
  return request<ProjectWorkflow>(
    session,
    `/api/projects/${projectId}/workflow/apply-template`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    },
  );
}

export type CreateEpicInput = {
  projectId: string;
  title: string;
  description: string | null;
};

export type CreateTaskInput = {
  parentId: number;
  title: string;
  description: string | null;
  stageId: string | null;
};

export async function createEpic(session: Session, input: CreateEpicInput) {
  let description = "";
  if (input.description !== null) {
    description = input.description;
  }
  return request<{
    id: string | number;
    title: string | null;
    projectName: string | null;
    parentId: number | null;
  }>(
    session,
    "/api/epics",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: input.projectId,
        title: input.title,
        description,
      }),
    },
  );
}

export async function createTask(session: Session, input: CreateTaskInput) {
  let description = "";
  if (input.description !== null) {
    description = input.description;
  }
  return request<{
    id: string | number;
    title: string | null;
    projectName: string | null;
    parentId: number | null;
  }>(
    session,
    "/api/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: input.parentId,
        title: input.title,
        description,
        stageId: input.stageId,
      }),
    },
  );
}

export async function fetchInbox(session: Session, query: InboxQuery = {
  projectId: null,
  commentsOnly: null,
  epicsOnly: null,
  cursor: null,
  limit: null,
}) {
  const params = new URLSearchParams();
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.commentsOnly) params.set("commentsOnly", "true");
  if (query.epicsOnly) params.set("epicsOnly", "true");
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  let suffix = "";
  if (params.toString()) {
    suffix = `?${params.toString()}`;
  }
  return request<InboxResult>(session, `/api/inbox${suffix}`);
}

export async function fetchAllInbox(
  session: Session,
  query: Omit<InboxQuery, "cursor"> = {
    projectId: null,
    commentsOnly: null,
    epicsOnly: null,
    limit: null,
  },
) {
  const items: InboxItem[] = [];
  let cursor: string | null = null;
  do {
    let pageLimit = 100;
    if (query.limit !== null) {
      pageLimit = query.limit;
    }
    const page = await fetchInbox(session, Object.assign({}, query, { cursor, limit: pageLimit }));
    for (const item of page.items) {
      items.push(item);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export async function fetchTask(session: Session, taskId: number) {
  return request<TaskDetail>(session, `/api/tasks/${taskId}`);
}

export async function addTaskComment(session: Session, taskId: number, text: string) {
  return request<TaskDetail>(session, `/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment: { text, by: "web" } }),
  });
}

export async function updateTaskDescription(session: Session, taskId: number, description: string) {
  return request<TaskDetail>(session, `/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

export async function fetchProjectWorkflow(session: Session, projectId: string) {
  return request<ProjectWorkflow>(session, `/api/projects/${projectId}/workflow`);
}

export async function saveProjectWorkflow(
  session: Session,
  projectId: string,
  input: { stages: WorkflowStage[]; roles: string[] },
) {
  return request<ProjectWorkflow>(session, `/api/projects/${projectId}/workflow`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function exportProjectWorkflow(session: Session, projectId: string) {
  return request<WorkflowExport>(session, `/api/projects/${projectId}/workflow/export`);
}

export async function createMember(
  session: Session,
  projectId: string,
  input: { name: string; role: string },
) {
  return request<ProjectMember>(session, `/api/projects/${projectId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      role: input.role,
    }),
  });
}

export async function updateMember(
  session: Session,
  projectId: string,
  memberId: string,
  input: { name: string | null; role: string | null },
) {
  return request<ProjectMember>(session, `/api/projects/${projectId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMember(session: Session, projectId: string, memberId: string) {
  await request<void>(session, `/api/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export async function fetchLibraries(session: Session, projectId: string) {
  const data = await request<{ items: LibrarySummary[] }>(
    session,
    `/api/projects/${projectId}/libraries`,
  );
  if (data.items !== null) {
    return data.items;
  }
  return [];
}

export async function fetchLibrary(session: Session, projectId: string, libraryId: string) {
  return request<LibraryDetail>(session, `/api/projects/${projectId}/libraries/${libraryId}`);
}

export async function createLibrary(
  session: Session,
  projectId: string,
  input: { title: string; id: string; description: string },
) {
  return request<LibraryDetail>(session, `/api/projects/${projectId}/libraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function saveLibrary(
  session: Session,
  projectId: string,
  libraryId: string,
  input: { title: string; description: string },
) {
  return request<LibraryDetail>(session, `/api/projects/${projectId}/libraries/${libraryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteLibrary(session: Session, projectId: string, libraryId: string) {
  await request<void>(session, `/api/projects/${projectId}/libraries/${libraryId}`, {
    method: "DELETE",
  });
}

export async function uploadLibraryDocument(
  session: Session,
  projectId: string,
  libraryId: string,
  file: File,
  title = "",
) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (title.trim() !== "") form.append("title", title.trim());
  return request<LibraryDocument>(
    session,
    `/api/projects/${projectId}/libraries/${libraryId}/documents/upload`,
    {
      method: "POST",
      body: form,
    },
  );
}

export async function replaceLibraryDocument(
  session: Session,
  projectId: string,
  libraryId: string,
  documentId: string,
  file: File,
) {
  const form = new FormData();
  form.append("file", file, file.name);
  return request<LibraryDocument>(
    session,
    `/api/projects/${projectId}/libraries/${libraryId}/documents/${documentId}/upload`,
    {
      method: "POST",
      body: form,
    },
  );
}

export async function fetchLibraryDocument(session: Session, documentId: string) {
  return request<LibraryDocument>(session, `/api/library-documents/${documentId}`);
}

export async function renameLibraryDocument(
  session: Session,
  projectId: string,
  libraryId: string,
  documentId: string,
  title: string,
) {
  return request<LibraryDocument>(
    session,
    `/api/projects/${projectId}/libraries/${libraryId}/documents/${documentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
}

export async function deleteLibraryDocument(
  session: Session,
  projectId: string,
  libraryId: string,
  documentId: string,
) {
  await request<void>(
    session,
    `/api/projects/${projectId}/libraries/${libraryId}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchLibrarySync(session: Session, projectId: string, libraryId = "") {
  const query = libraryId !== "" ? `?libraryId=${encodeURIComponent(libraryId)}` : "";
  const data = await request<{ items: LibrarySyncItem[] }>(
    session,
    `/api/projects/${projectId}/library/sync${query}`,
  );
  if (data.items !== null) return data.items;
  return [];
}

export async function downloadLibraryDocument(session: Session, documentId: string): Promise<Blob> {
  const res = await fetch(`/api/library-documents/${documentId}/content`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) throw new ApiError("Download failed", res.status);
  return res.blob();
}

export async function linkLibraryDocument(
  session: Session,
  documentId: string,
  taskId: number,
) {
  const data = await request<{ items: LibraryDocumentLink[] }>(
    session,
    `/api/library-documents/${documentId}/links`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    },
  );
  if (data.items !== null) {
    return data.items;
  }
  return [];
}

export async function unlinkLibraryDocument(
  session: Session,
  documentId: string,
  taskId: number,
) {
  await request<void>(session, `/api/library-documents/${documentId}/links/${taskId}`, {
    method: "DELETE",
  });
}

export async function fetchTaskLibraryLinks(session: Session, taskId: number) {
  const data = await request<{ items: LibraryDocumentLink[] }>(
    session,
    `/api/tasks/${taskId}/library-links`,
  );
  if (data.items !== null) {
    return data.items;
  }
  return [];
}

export async function claimTask(session: Session, taskId: number, claimedBy: string) {
  return request<{ id: number; claimedBy: string | null }>(session, `/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimedBy }),
  });
}

export async function updateTaskWorkStatus(
  session: Session,
  taskId: number,
  workStatus: WorkStatus,
  claimedBy: string | null = null,
) {
  const body: { workStatus: WorkStatus; claimedBy?: string } = { workStatus };
  if (claimedBy !== null && claimedBy.trim() !== "") {
    body.claimedBy = claimedBy.trim();
  }
  return request<TaskDetail>(session, `/api/tasks/${taskId}/work-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type MarketplaceListingSummary = {
  id: string;
  sellerUserId: string;
  sellerName: string;
  sourceTemplateId: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  stageCount: number;
  owned: boolean;
  isOwnListing: boolean;
  purchasedTemplateId: string | null;
  publishedAt: string | null;
};

export type MarketplaceListingDetail = MarketplaceListingSummary & {
  stages: WorkflowStage[];
};

export async function fetchMarketplaceListings(session: Session) {
  const data = await request<{ items: MarketplaceListingSummary[] }>(
    session,
    "/api/marketplace/listings",
  );
  if (data.items !== null) return data.items;
  return [];
}

export async function fetchMyMarketplaceListings(session: Session) {
  const data = await request<{ items: MarketplaceListingSummary[] }>(
    session,
    "/api/marketplace/my-listings",
  );
  if (data.items !== null) return data.items;
  return [];
}

export async function updateMarketplaceListing(
  session: Session,
  listingId: string,
  input: {
    title: string;
    description: string;
    category: string;
    priceCents: number;
  },
) {
  const data = await request<{ listing: MarketplaceListingSummary }>(
    session,
    `/api/marketplace/listings/${listingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.listing;
}

export async function unlistMarketplaceListing(session: Session, listingId: string) {
  await request<void>(session, `/api/marketplace/listings/${listingId}`, {
    method: "DELETE",
  });
}

export async function fetchMarketplacePurchases(session: Session) {
  const data = await request<{
    items: Array<{
      id: string;
      listingId: string;
      amountCents: number;
      purchasedTemplateId: string;
      createdAt: string;
      listingTitle: string;
      sellerName: string;
    }>;
  }>(session, "/api/marketplace/purchases");
  if (data.items !== null) return data.items;
  return [];
}

export async function fetchMarketplaceSales(session: Session) {
  const data = await request<{
    items: Array<{
      id: string;
      listingId: string;
      listingTitle: string;
      buyerName: string;
      amountCents: number;
      createdAt: string;
    }>;
  }>(session, "/api/marketplace/sales");
  if (data.items !== null) return data.items;
  return [];
}

export async function fetchMarketplaceListing(session: Session, listingId: string) {
  const data = await request<{ listing: MarketplaceListingDetail | null }>(
    session,
    `/api/marketplace/listings/${listingId}`,
  );
  return data.listing;
}

export async function publishMarketplaceListing(
  session: Session,
  input: {
    sourceTemplateId: string;
    title: string;
    description: string;
    category: string;
    priceCents: number;
  },
) {
  const data = await request<{ listing: MarketplaceListingSummary }>(
    session,
    "/api/marketplace/listings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.listing;
}

export async function purchaseMarketplaceListing(session: Session, listingId: string) {
  return request<{ purchasedTemplateId: string; listing: MarketplaceListingSummary }>(
    session,
    `/api/marketplace/listings/${listingId}/purchase`,
    { method: "POST" },
  );
}

export async function fetchPublishableTemplates(session: Session) {
  const data = await request<{ items: WorkflowTemplateSummary[] }>(
    session,
    "/api/marketplace/publishable-templates",
  );
  if (data.items !== null) return data.items;
  return [];
}

export type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function fetchApiKeys(session: Session) {
  const data = await request<{ items: ApiKeySummary[] }>(session, "/api/me/api-keys");
  if (data.items !== null) return data.items;
  return [];
}

export async function createApiKey(session: Session, name: string) {
  return request<{ key: ApiKeySummary; rawKey: string }>(session, "/api/me/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(session: Session, keyId: string) {
  await request<void>(session, `/api/me/api-keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
  });
}
