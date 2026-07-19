import { getAccessToken } from "@/lib/auth";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  const token = getAccessToken();
  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof body["error"] === "string" ? body["error"] : `http ${String(response.status)}`;
    throw new Error(message);
  }
  return body as T;
}

export type GithubStatus = { configured: boolean; connected: boolean; login: string | null };
export type GithubRepo = { fullName: string; private: boolean; defaultBranch: string };
export type GitStatus =
  | { linked: false }
  | { linked: true; owner: string; repo: string; branch: string; dirty: boolean; ahead: number; behind: number };

export const codeApi = {
  githubStatus(): Promise<GithubStatus> {
    return fetchJson("/api/v1/github/status");
  },
  githubConnectUrl(): Promise<{ url: string }> {
    return fetchJson("/api/v1/github/connect");
  },
  githubDisconnect(): Promise<{ ok: boolean }> {
    return fetchJson("/api/v1/github/disconnect", { method: "POST" });
  },
  githubRepos(): Promise<{ repos: GithubRepo[] }> {
    return fetchJson("/api/v1/github/repos");
  },
  gitStatus(projectId: string): Promise<GitStatus> {
    return fetchJson(`/api/v1/projects/${projectId}/git`);
  },
  linkRepo(projectId: string, body: { owner: string; repo: string; branch: string }): Promise<{ linked: true }> {
    return fetchJson(`/api/v1/projects/${projectId}/git/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  pull(projectId: string): Promise<{ ok: boolean }> {
    return fetchJson(`/api/v1/projects/${projectId}/git/pull`, { method: "POST" });
  },
  push(projectId: string, message: string): Promise<{ ok: boolean }> {
    return fetchJson(`/api/v1/projects/${projectId}/git/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
  },
  startIde(projectId: string): Promise<{ url: string }> {
    return fetchJson(`/api/v1/projects/${projectId}/ide/start`, { method: "POST" });
  },
  stopIde(projectId: string): Promise<{ ok: boolean }> {
    return fetchJson(`/api/v1/projects/${projectId}/ide/stop`, { method: "POST" });
  },
};
