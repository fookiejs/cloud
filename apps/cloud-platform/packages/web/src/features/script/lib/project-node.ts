import { z } from "zod";

function bindingKey(projectId: string): string {
  const parsedProjectId = z.string().trim().min(1).parse(projectId);
  const namespace = "fookie.cloud.project-node.v1";
  const separator = ":";
  const key = `${namespace}${separator}${parsedProjectId}`;
  return key;
}

export function loadProjectWorkspaceId(projectId: string): string | false {
  const key = bindingKey(projectId);
  const stored = window.localStorage.getItem(key);
  const parsed = z.string().trim().min(1).safeParse(stored);
  if (!parsed.success) {
    return false;
  }
  return parsed.data;
}

export function saveProjectWorkspaceId(projectId: string, workspaceId: string): void {
  const key = bindingKey(projectId);
  const parsedWorkspaceId = z.string().trim().min(1).parse(workspaceId);
  window.localStorage.setItem(key, parsedWorkspaceId);
  window.dispatchEvent(new Event("fookie:project-node"));
}

export function clearProjectWorkspaceId(projectId: string): void {
  const key = bindingKey(projectId);
  window.localStorage.removeItem(key);
  window.dispatchEvent(new Event("fookie:project-node"));
}
