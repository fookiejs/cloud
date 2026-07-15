import { clearFookieTokens } from "./auth";

export type UserRole = "admin" | "read-write" | "read";

export type Session = {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
  projectId: string | null;
  projectName: string | null;
};

const KEY = "task-bridge.session.v2";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    const token = parsed.token;
    const userId = parsed.userId;
    if (token === null || token.trim() === "") return null;
    if (userId === null || userId.trim() === "") return null;
    return Object.assign({}, parsed, {
      mustChangePassword: parsed.mustChangePassword === true,
    });
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  clearFookieTokens();
}

export function setSelectedProject(projectId: string, projectName: string) {
  const current = loadSession();
  if (!current) return;
  saveSession(Object.assign({}, current, { projectId, projectName }));
}

export function clearSelectedProject() {
  const current = loadSession();
  if (!current) return;
  saveSession(Object.assign({}, current, { projectId: null, projectName: null }));
}
