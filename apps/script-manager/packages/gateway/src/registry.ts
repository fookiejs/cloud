import type { WebSocket } from 'ws';
import { nanoid } from 'nanoid';

export interface AgentInfo {
  hostname: string;
  version: string;
  connectedAt: number;
}

interface Pending {
  resolve: (value: AgentHttpResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface AgentHttpResponse {
  type: 'http.response';
  id: string;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface AgentSession {
  userId: string;
  socket: WebSocket;
  info: AgentInfo;
  pending: Map<string, Pending>;
  consoleSockets: Set<WebSocket>;
}

const agents = new Map<string, AgentSession>();
const consoleOnly = new Map<string, Set<WebSocket>>();

function fanout(userId: string, msg: unknown): void {
  const raw = JSON.stringify(msg);
  const agent = agents.get(userId);
  if (agent !== undefined) {
    for (const s of agent.consoleSockets) {
      if (s.readyState === 1) {
        s.send(raw);
      }
    }
  }
  const extras = consoleOnly.get(userId);
  if (extras !== undefined) {
    for (const s of extras) {
      if (s.readyState === 1) {
        s.send(raw);
      }
    }
  }
}

export function registerAgent(userId: string, socket: WebSocket, info: AgentInfo): AgentSession | null {
  const existing = agents.get(userId);
  if (existing !== undefined && existing.socket.readyState === 1) {
    return null;
  }
  if (existing !== undefined) {
    for (const [, p] of existing.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('agent replaced'));
    }
  }
  const consoles = new Set<WebSocket>();
  if (existing !== undefined) {
    for (const s of existing.consoleSockets) {
      consoles.add(s);
    }
  }
  const parked = consoleOnly.get(userId);
  if (parked !== undefined) {
    for (const s of parked) {
      consoles.add(s);
    }
    consoleOnly.delete(userId);
  }
  const session: AgentSession = {
    userId,
    socket,
    info,
    pending: new Map(),
    consoleSockets: consoles,
  };
  agents.set(userId, session);
  fanout(userId, { type: 'agent.status', online: true, info });
  return session;
}

export function unregisterAgent(userId: string, socket: WebSocket): void {
  const session = agents.get(userId);
  if (session === undefined || session.socket !== socket) {
    return;
  }
  for (const [, p] of session.pending) {
    clearTimeout(p.timer);
    p.reject(new Error('agent disconnected'));
  }
  session.pending.clear();
  const lingering = session.consoleSockets;
  agents.delete(userId);
  if (lingering.size > 0) {
    consoleOnly.set(userId, lingering);
  }
  fanout(userId, { type: 'agent.status', online: false, info: null });
}

export function getAgent(userId: string): AgentSession | null {
  return agents.get(userId) ?? null;
}

export function listAgentStatus(userId: string): {
  online: boolean;
  info: AgentInfo | null;
} {
  const session = agents.get(userId);
  if (session === undefined) {
    return { online: false, info: null };
  }
  return { online: true, info: session.info };
}

export function addConsole(userId: string, socket: WebSocket): void {
  const agent = agents.get(userId);
  if (agent !== undefined) {
    agent.consoleSockets.add(socket);
    socket.send(JSON.stringify({ type: 'agent.status', online: true, info: agent.info }));
    return;
  }
  let set = consoleOnly.get(userId);
  if (set === undefined) {
    set = new Set();
    consoleOnly.set(userId, set);
  }
  set.add(socket);
  socket.send(JSON.stringify({ type: 'agent.status', online: false, info: null }));
}

export function removeConsole(userId: string, socket: WebSocket): void {
  agents.get(userId)?.consoleSockets.delete(socket);
  consoleOnly.get(userId)?.delete(socket);
}

export function handleAgentMessage(userId: string, raw: string): void {
  const session = agents.get(userId);
  if (session === undefined) {
    return;
  }
  let msg: unknown;
  try {
    msg = JSON.parse(raw) as unknown;
  } catch {
    return;
  }
  if (typeof msg !== 'object' || msg === null) {
    return;
  }
  const rec = msg as Record<string, unknown>;
  if (rec['type'] === 'ping') {
    if (session.socket.readyState === 1) {
      session.socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
    }
    return;
  }
  if (rec['type'] === 'http.response' && typeof rec['id'] === 'string') {
    const pending = session.pending.get(rec['id']);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timer);
    session.pending.delete(rec['id']);
    pending.resolve(msg as AgentHttpResponse);
    return;
  }
  if (rec['type'] === 'event') {
    fanout(userId, rec['payload'] ?? msg);
  }
}

export async function proxyHttp(
  userId: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<AgentHttpResponse> {
  const session = agents.get(userId);
  if (session === undefined) {
    throw new Error('agent offline');
  }
  const id = nanoid();
  const req = {
    type: 'http.request',
    id,
    method,
    path,
    headers,
    body,
  };
  return await new Promise<AgentHttpResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(id);
      reject(new Error('agent timeout'));
    }, 60_000);
    session.pending.set(id, { resolve, reject, timer });
    if (session.socket.readyState !== 1) {
      clearTimeout(timer);
      session.pending.delete(id);
      reject(new Error('agent offline'));
      return;
    }
    session.socket.send(JSON.stringify(req));
  });
}
