import type { ProjectExportBundle } from '../lib/project-export.js';
import type {
  ProjectScriptSettings,
  Task,
  Execution,
  Environment,
  RunningSnapshot,
} from '../types.js';
import { getAccessToken, isCloudHost } from '@/lib/auth';

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  if (isCloudHost()) {
    const token = getAccessToken();
    if (token !== null) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return headers;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let extra: HeadersInit | undefined;
  if (init !== undefined) extra = init.headers;
  const headers = authHeaders(extra);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${String(res.status)}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface ScriptSnapshot {
  settings: ProjectScriptSettings;
  environments: Environment[];
  tasks: Task[];
  executions: Execution[];
  running: RunningSnapshot[];
}

export const api = {
  // Single round trip for the whole script page: settings, environments, tasks and
  // recent executions for every task in the project, replacing the old
  // workspace-fetch -> per-task-execution-fetch waterfall.
  getScriptSnapshot(projectId: string, perTaskLimit = 20): Promise<ScriptSnapshot> {
    return jsonFetch(
      `/api/v1/projects/${encodeURIComponent(projectId)}/script-snapshot?limit=${String(perTaskLimit)}`,
    );
  },
  pauseProject(projectId: string): Promise<{ settings: ProjectScriptSettings }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/pause`, {
      method: 'POST',
    });
  },
  resumeProject(projectId: string): Promise<{ settings: ProjectScriptSettings }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/resume`, {
      method: 'POST',
    });
  },
  exportProject(projectId: string): Promise<ProjectExportBundle> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/export`);
  },
  listEnvironments(projectId: string): Promise<{ environments: Environment[] }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/environments`);
  },
  createEnvironment(
    projectId: string,
    body: { name: string; vars?: Record<string, string> },
  ): Promise<{ environment: Environment }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/environments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  updateEnvironment(
    id: string,
    body: { name?: string; vars?: Record<string, string> },
  ): Promise<{ environment: Environment }> {
    return jsonFetch(`/api/v1/environments/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  deleteEnvironment(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/v1/environments/${id}`, { method: 'DELETE' });
  },
  setActiveEnvironment(
    projectId: string,
    environmentId: string | null,
  ): Promise<{ settings: ProjectScriptSettings }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/active-environment`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ environment_id: environmentId }),
    });
  },
  listTasks(projectId: string): Promise<{ tasks: Task[]; nextCursor: string | null }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`);
  },
  createTask(
    projectId: string,
    body: Omit<Task, 'id' | 'project_id' | 'created_at'>,
  ): Promise<{ task: Task }> {
    return jsonFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  getTask(id: string): Promise<{ task: Task }> {
    return jsonFetch(`/api/v1/tasks/${id}`);
  },
  updateTask(
    id: string,
    body: Omit<Task, 'id' | 'project_id' | 'created_at'>,
  ): Promise<{ task: Task }> {
    return jsonFetch(`/api/v1/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  deleteTask(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/v1/tasks/${id}`, { method: 'DELETE' });
  },
  runTask(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/v1/tasks/${id}/run`, { method: 'POST' });
  },
  cancelExecution(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/v1/executions/${id}/cancel`, { method: 'POST' });
  },
  listRunningExecutions(): Promise<{ running: RunningSnapshot[] }> {
    return jsonFetch('/api/v1/executions/running');
  },
  listExecutions(taskId: string, limit: number): Promise<{ executions: Execution[] }> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('taskId', taskId);
    return jsonFetch(`/api/v1/executions?${params.toString()}`);
  },
  getExecutionLog(id: string): Promise<{ log: string }> {
    return jsonFetch(`/api/v1/executions/${id}/log`);
  },
};
