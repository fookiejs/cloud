import type { ProjectExportBundle } from '../lib/project-export.js';
import type { Workspace, Task, Execution, Environment, RunningSnapshot } from '../types.js';
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
  const headers = authHeaders(init?.headers);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${String(res.status)}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  pickFolder(): Promise<{ path: string | null }> {
    return jsonFetch('/api/v1/system/pick-folder', { method: 'POST' });
  },
  listWorkspaces(): Promise<{ workspaces: Workspace[] }> {
    return jsonFetch('/api/v1/workspaces');
  },
  createWorkspace(name: string, path: string): Promise<{ workspace: Workspace }> {
    return jsonFetch('/api/v1/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, path }),
    });
  },
  updateWorkspace(
    id: string,
    body: { name?: string; path?: string },
  ): Promise<{ workspace: Workspace }> {
    return jsonFetch(`/api/v1/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  pauseWorkspace(id: string): Promise<{ workspace: Workspace }> {
    return jsonFetch(`/api/v1/workspaces/${id}/pause`, { method: 'POST' });
  },
  resumeWorkspace(id: string): Promise<{ workspace: Workspace }> {
    return jsonFetch(`/api/v1/workspaces/${id}/resume`, { method: 'POST' });
  },
  deleteWorkspace(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/v1/workspaces/${id}`, { method: 'DELETE' });
  },
  exportProject(workspaceId: string): Promise<ProjectExportBundle> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/export`);
  },
  importProject(body: {
    bundle: ProjectExportBundle;
    name: string;
    path: string;
  }): Promise<{ workspace: Workspace; taskCount: number }> {
    return jsonFetch('/api/v1/workspaces/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  listEnvironments(workspaceId: string): Promise<{ environments: Environment[] }> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/environments`);
  },
  createEnvironment(
    workspaceId: string,
    body: { name: string; vars?: Record<string, string> },
  ): Promise<{ environment: Environment }> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/environments`, {
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
    workspaceId: string,
    environmentId: string | null,
  ): Promise<{ workspace: Workspace }> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/active-environment`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ environment_id: environmentId }),
    });
  },
  listTasks(workspaceId: string): Promise<{ tasks: Task[] }> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/tasks`);
  },
  listTasksPage(
    workspaceId: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ tasks: Task[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (cursor !== null) {
      params.set('cursor', cursor);
    }
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/tasks?${params.toString()}`);
  },
  createTask(
    workspaceId: string,
    body: Omit<Task, 'id' | 'workspace_id' | 'created_at'>,
  ): Promise<{ task: Task }> {
    return jsonFetch(`/api/v1/workspaces/${workspaceId}/tasks`, {
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
    body: Omit<Task, 'id' | 'workspace_id' | 'created_at'>,
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
  listExecutions(taskId: string | null, limit: number): Promise<{ executions: Execution[] }> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (taskId !== null) {
      params.set('taskId', taskId);
    }
    return jsonFetch(`/api/v1/executions?${params.toString()}`);
  },
  getExecutionLog(id: string): Promise<{ log: string }> {
    return jsonFetch(`/api/v1/executions/${id}/log`);
  },
};
