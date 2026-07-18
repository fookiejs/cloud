import Database from "better-sqlite3";
import Docker from "dockerode";
import cron, { type ScheduledTask } from "node-cron";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { nanoid } from "nanoid";
import type { WebSocket } from "ws";
import type { Identity, IdentityUser } from "./identity.js";

type RuntimeKind = "shell" | "docker";
type TriggerKind = "save" | "manual" | "startup" | "scheduled";
type ConcurrencyKind = "restart" | "queue" | "ignore" | "parallel";
type ExecutionStatus = "pending" | "running" | "success" | "failed" | "cancelled";

type Workspace = {
  id: string;
  owner_id: string;
  project_id: string;
  name: string;
  path: string;
  paused: boolean;
  active_environment_id: string | null;
  created_at: number;
};

type Environment = {
  id: string;
  workspace_id: string;
  name: string;
  vars: Record<string, string>;
  created_at: number;
};

type Task = {
  id: string;
  workspace_id: string;
  name: string;
  command: string;
  runtime: RuntimeKind;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: TriggerKind;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: ConcurrencyKind;
  enabled: boolean;
  created_at: number;
};

type Execution = {
  id: string;
  task_id: string;
  status: ExecutionStatus;
  started_at: number | null;
  ended_at: number | null;
  exit_code: number | null;
  trigger_reason: string;
  log_path: string;
};

type ServerMessage =
  | { kind: "execution.started"; executionId: string; taskId: string; ts: number }
  | { kind: "execution.log"; executionId: string; line: string; stream: "out" | "err"; ts: number }
  | {
      kind: "execution.ended";
      executionId: string;
      status: ExecutionStatus;
      exitCode: number | null;
      ts: number;
    }
  | { kind: "task.updated"; taskId: string }
  | { kind: "task.deleted"; taskId: string }
  | { kind: "workspace.updated"; workspaceId: string }
  | { kind: "workspace.deleted"; workspaceId: string }
  | {
      kind: "hello";
      ts: number;
      running: { executionId: string; taskId: string; startedAt: number }[];
    };

export type ScriptRunnerOptions = {
  identity: Identity;
  dataDir: string;
  workspacesHostDir: string | null;
  sandboxImage: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  active_environment_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id, project_id);
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vars_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_environments_workspace ON environments(workspace_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  runtime TEXT NOT NULL,
  docker_image TEXT,
  docker_platform TEXT,
  trigger_type TEXT NOT NULL,
  trigger_glob TEXT,
  trigger_cron TEXT,
  concurrency TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  exit_code INTEGER,
  trigger_reason TEXT NOT NULL,
  log_path TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id, started_at DESC);
`;

function isRuntime(v: unknown): v is RuntimeKind {
  return v === "shell" || v === "docker";
}
function isTrigger(v: unknown): v is TriggerKind {
  return v === "save" || v === "manual" || v === "startup" || v === "scheduled";
}
function isConcurrency(v: unknown): v is ConcurrencyKind {
  return v === "restart" || v === "queue" || v === "ignore" || v === "parallel";
}

type CreateTaskBody = {
  name: string;
  command: string;
  runtime: RuntimeKind;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: TriggerKind;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: ConcurrencyKind;
  enabled: boolean;
};

function optionalString(raw: unknown): string | null | "invalid" {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return "invalid";
  }
  if (raw.length === 0) {
    return null;
  }
  return raw;
}

function validateCreateTask(body: unknown): CreateTaskBody | string {
  if (typeof body !== "object" || body === null) {
    return "body must be object";
  }
  const b = body as Record<string, unknown>;
  if (typeof b["name"] !== "string" || b["name"].length === 0) {
    return "name required";
  }
  if (typeof b["command"] !== "string" || b["command"].length === 0) {
    return "command required";
  }
  if (!isRuntime(b["runtime"])) {
    return "invalid runtime";
  }
  if (!isTrigger(b["trigger_type"])) {
    return "invalid trigger_type";
  }
  if (!isConcurrency(b["concurrency"])) {
    return "invalid concurrency";
  }
  const dockerImage = optionalString(b["docker_image"]);
  if (dockerImage === "invalid") {
    return "docker_image must be string or null";
  }
  const dockerPlatform = optionalString(b["docker_platform"]);
  if (dockerPlatform === "invalid") {
    return "docker_platform must be string or null";
  }
  const triggerGlob = optionalString(b["trigger_glob"]);
  if (triggerGlob === "invalid") {
    return "trigger_glob must be string or null";
  }
  const triggerCron = optionalString(b["trigger_cron"]);
  if (triggerCron === "invalid") {
    return "trigger_cron must be string or null";
  }
  if (b["trigger_type"] === "scheduled") {
    if (triggerCron === null || !cron.validate(triggerCron)) {
      return "valid trigger_cron required for scheduled tasks";
    }
  }
  let enabled = true;
  if (b["enabled"] !== undefined) {
    if (typeof b["enabled"] !== "boolean") {
      return "enabled must be boolean";
    }
    enabled = b["enabled"];
  }
  return {
    name: b["name"],
    command: b["command"],
    runtime: b["runtime"],
    docker_image: dockerImage,
    docker_platform: dockerPlatform,
    trigger_type: b["trigger_type"],
    trigger_glob: triggerGlob,
    trigger_cron: triggerCron,
    concurrency: b["concurrency"],
    enabled,
  };
}

function parseEnvVarsBody(raw: unknown): Record<string, string> | string {
  if (raw === undefined) {
    return {};
  }
  if (typeof raw !== "object" || raw === null) {
    return "vars must be object";
  }
  const out: Record<string, string> = {};
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.length === 0) {
      return "env key cannot be empty";
    }
    const val = obj[key];
    if (typeof val !== "string") {
      return `env value for ${key} must be string`;
    }
    out[key] = val;
  }
  return out;
}

function tokenFromWsProtocols(raw: string | string[] | undefined): string | null {
  if (raw === undefined) {
    return null;
  }
  const protocols = (Array.isArray(raw) ? raw.join(",") : raw)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const bearerIdx = protocols.findIndex((p) => p.toLowerCase() === "bearer");
  if (bearerIdx >= 0) {
    const next = protocols[bearerIdx + 1];
    if (next !== undefined && next.length > 0) {
      return next;
    }
  }
  return null;
}

function bearerFromRequest(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) {
      return token;
    }
  }
  return tokenFromWsProtocols(request.headers["sec-websocket-protocol"]);
}

export async function registerScriptRunnerModule(
  app: FastifyInstance,
  options: ScriptRunnerOptions,
): Promise<void> {
  const workspacesDir = join(options.dataDir, "workspaces");
  const logsDir = join(options.dataDir, "logs");
  mkdirSync(workspacesDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const db = new Database(join(options.dataDir, "script.db"));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const docker = new Docker();
  const memoryLimitMb = Number(process.env.SCRIPT_MEMORY_LIMIT_MB ?? 1024);
  const cpuLimit = Number(process.env.SCRIPT_CPU_LIMIT ?? 1);
  const startedAtBoot = Date.now();

  type WorkspaceRow = {
    id: string;
    owner_id: string;
    project_id: string;
    name: string;
    paused: number;
    active_environment_id: string | null;
    created_at: number;
  };
  type EnvironmentRow = {
    id: string;
    workspace_id: string;
    name: string;
    vars_json: string;
    created_at: number;
  };
  type TaskRow = {
    id: string;
    workspace_id: string;
    name: string;
    command: string;
    runtime: string;
    docker_image: string | null;
    docker_platform: string | null;
    trigger_type: string;
    trigger_glob: string | null;
    trigger_cron: string | null;
    concurrency: string;
    enabled: number;
    created_at: number;
  };

  function toWorkspace(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      owner_id: row.owner_id,
      project_id: row.project_id,
      name: row.name,
      path: `/workspaces/${row.id}`,
      paused: row.paused === 1,
      active_environment_id: row.active_environment_id,
      created_at: row.created_at,
    };
  }

  function toEnvironment(row: EnvironmentRow): Environment {
    let vars: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(row.vars_json);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "string") {
            vars[key] = value;
          }
        }
      }
    } catch {
      vars = {};
    }
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      vars,
      created_at: row.created_at,
    };
  }

  function toTask(row: TaskRow): Task {
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      command: row.command,
      runtime: isRuntime(row.runtime) ? row.runtime : "shell",
      docker_image: row.docker_image,
      docker_platform: row.docker_platform,
      trigger_type: isTrigger(row.trigger_type) ? row.trigger_type : "manual",
      trigger_glob: row.trigger_glob,
      trigger_cron: row.trigger_cron,
      concurrency: isConcurrency(row.concurrency) ? row.concurrency : "ignore",
      enabled: row.enabled === 1,
      created_at: row.created_at,
    };
  }

  function getWorkspace(id: string): Workspace | null {
    const row = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as
      | WorkspaceRow
      | undefined;
    return row === undefined ? null : toWorkspace(row);
  }

  function getOwnedWorkspace(id: string, user: IdentityUser): Workspace | null {
    const w = getWorkspace(id);
    if (w === null || w.owner_id !== user.id) {
      return null;
    }
    return w;
  }

  function getTask(id: string): Task | null {
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
    return row === undefined ? null : toTask(row);
  }

  function getOwnedTask(id: string, user: IdentityUser): { task: Task; workspace: Workspace } | null {
    const task = getTask(id);
    if (task === null) {
      return null;
    }
    const workspace = getOwnedWorkspace(task.workspace_id, user);
    if (workspace === null) {
      return null;
    }
    return { task, workspace };
  }

  function getExecution(id: string): Execution | null {
    const row = db.prepare("SELECT * FROM executions WHERE id = ?").get(id) as
      | Execution
      | undefined;
    return row === undefined ? null : { ...row, status: row.status };
  }

  function listEnvironments(workspaceId: string): Environment[] {
    const rows = db
      .prepare("SELECT * FROM environments WHERE workspace_id = ? ORDER BY created_at ASC")
      .all(workspaceId) as EnvironmentRow[];
    return rows.map(toEnvironment);
  }

  function listTasks(workspaceId: string): Task[] {
    const rows = db
      .prepare("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at ASC")
      .all(workspaceId) as TaskRow[];
    return rows.map(toTask);
  }

  function resolveActiveEnvVars(workspace: Workspace): Record<string, string> {
    if (workspace.active_environment_id === null) {
      return {};
    }
    const row = db
      .prepare("SELECT * FROM environments WHERE id = ?")
      .get(workspace.active_environment_id) as EnvironmentRow | undefined;
    if (row === undefined) {
      return {};
    }
    return toEnvironment(row).vars;
  }

  const sockets = new Map<string, Set<WebSocket>>();
  const running = new Map<
    string,
    { taskId: string; ownerId: string; startedAt: number; cancel: () => void }
  >();
  const queued = new Set<string>();
  const cronJobs = new Map<string, ScheduledTask>();

  function broadcast(ownerId: string, msg: ServerMessage): void {
    const set = sockets.get(ownerId);
    if (set === undefined) {
      return;
    }
    const payload = JSON.stringify(msg);
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  function runningSnapshotFor(ownerId: string): { executionId: string; taskId: string; startedAt: number }[] {
    const out: { executionId: string; taskId: string; startedAt: number }[] = [];
    for (const [executionId, info] of running.entries()) {
      if (info.ownerId === ownerId) {
        out.push({ executionId, taskId: info.taskId, startedAt: info.startedAt });
      }
    }
    return out;
  }

  function hostWorkspacePath(workspaceId: string): string {
    if (options.workspacesHostDir !== null && options.workspacesHostDir.length > 0) {
      return `${options.workspacesHostDir.replace(/\/$/, "")}/${workspaceId}`;
    }
    return join(workspacesDir, workspaceId);
  }

  function sandboxEnv(custom: Record<string, string>): string[] {
    const base: Record<string, string> = {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      HOME: "/workspace",
      LANG: "C.UTF-8",
      npm_config_prefix: "/workspace/.npm-global",
    };
    for (const [key, value] of Object.entries(custom)) {
      base[key] = value;
    }
    return Object.entries(base).map(([key, value]) => `${key}=${value}`);
  }

  function isTaskRunning(taskId: string): boolean {
    for (const info of running.values()) {
      if (info.taskId === taskId) {
        return true;
      }
    }
    return false;
  }

  function cancelRunningForTask(taskId: string): void {
    for (const info of running.values()) {
      if (info.taskId === taskId) {
        info.cancel();
      }
    }
  }

  function finalizeExecution(
    executionId: string,
    ownerId: string,
    status: ExecutionStatus,
    exitCode: number | null,
  ): void {
    const exec = getExecution(executionId);
    running.delete(executionId);
    if (exec === null || (exec.status !== "running" && exec.status !== "pending")) {
      return;
    }
    const endedAt = Date.now();
    db.prepare("UPDATE executions SET status = ?, ended_at = ?, exit_code = ? WHERE id = ?").run(
      status,
      endedAt,
      exitCode,
      executionId,
    );
    broadcast(ownerId, {
      kind: "execution.ended",
      executionId,
      status,
      exitCode,
      ts: endedAt,
    });
    const task = getTask(exec.task_id);
    if (task !== null && queued.delete(task.id)) {
      triggerTask(task, "queue:drain");
    }
  }

  function startExecution(task: Task, workspace: Workspace, reason: string): void {
    const executionId = nanoid(12);
    const now = Date.now();
    const logPath = join(logsDir, `${executionId}.log`);
    db.prepare(
      "INSERT INTO executions (id, task_id, status, started_at, ended_at, exit_code, trigger_reason, log_path) VALUES (?, ?, 'running', ?, NULL, NULL, ?, ?)",
    ).run(executionId, task.id, now, reason, logPath);
    broadcast(workspace.owner_id, {
      kind: "execution.started",
      executionId,
      taskId: task.id,
      ts: now,
    });

    const logFile = createWriteStream(logPath, { flags: "a", encoding: "utf8" });
    let cancelled = false;
    let exited = false;
    let container: Docker.Container | null = null;

    function write(line: string, stream: "out" | "err"): void {
      const clean = line.replace(/\r$/, "");
      logFile.write(`${stream}\t${clean}\n`);
      broadcast(workspace.owner_id, {
        kind: "execution.log",
        executionId,
        line: clean,
        stream,
        ts: Date.now(),
      });
    }

    function emitLines(buf: string, stream: "out" | "err"): string {
      let rest = buf;
      let idx = rest.indexOf("\n");
      while (idx !== -1) {
        write(rest.slice(0, idx), stream);
        rest = rest.slice(idx + 1);
        idx = rest.indexOf("\n");
      }
      return rest;
    }

    function finish(status: ExecutionStatus, exitCode: number | null): void {
      if (exited) {
        return;
      }
      exited = true;
      logFile.end();
      finalizeExecution(executionId, workspace.owner_id, status, exitCode);
    }

    running.set(executionId, {
      taskId: task.id,
      ownerId: workspace.owner_id,
      startedAt: now,
      cancel(): void {
        if (cancelled || exited) {
          return;
        }
        cancelled = true;
        if (container === null) {
          finish("cancelled", null);
          return;
        }
        container.kill().catch(() => {
          finish("cancelled", null);
        });
      },
    });

    const image =
      task.runtime === "docker" && task.docker_image !== null && task.docker_image.length > 0
        ? task.docker_image
        : options.sandboxImage;

    async function run(): Promise<void> {
      try {
        try {
          await docker.getImage(image).inspect();
        } catch {
          write(`[script] pulling ${image}...`, "out");
          const pullOpts: { platform?: string } = {};
          if (task.docker_platform !== null && task.docker_platform.length > 0) {
            pullOpts.platform = task.docker_platform;
          }
          const stream = await docker.pull(image, pullOpts);
          await new Promise<void>((resolvePull, rejectPull) => {
            docker.modem.followProgress(stream, (err: Error | null) => {
              if (err === null) {
                resolvePull();
                return;
              }
              rejectPull(err);
            });
          });
        }

        const customEnv = resolveActiveEnvVars(workspace);
        write(`[script] sandbox image=${image} workspace=${workspace.id}`, "out");

        const createOpts: Docker.ContainerCreateOptions = {
          Image: image,
          Cmd: ["/bin/sh", "-c", task.command],
          WorkingDir: "/workspace",
          Env: sandboxEnv(customEnv),
          Tty: false,
          HostConfig: {
            AutoRemove: true,
            Binds: [`${hostWorkspacePath(workspace.id)}:/workspace:rw`],
            Memory: memoryLimitMb * 1024 * 1024,
            NanoCpus: Math.round(cpuLimit * 1_000_000_000),
            PidsLimit: 512,
            SecurityOpt: ["no-new-privileges"],
            NetworkMode: "bridge",
          },
        };
        if (task.docker_platform !== null && task.docker_platform.length > 0) {
          createOpts.platform = task.docker_platform;
        }
        container = await docker.createContainer(createOpts);

        const attached = await container.attach({ stream: true, stdout: true, stderr: true });
        let outBuf = "";
        let errBuf = "";
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        stdout.on("data", (chunk: Buffer) => {
          outBuf = emitLines(outBuf + chunk.toString("utf8"), "out");
        });
        stderr.on("data", (chunk: Buffer) => {
          errBuf = emitLines(errBuf + chunk.toString("utf8"), "err");
        });
        docker.modem.demuxStream(attached, stdout, stderr);

        await container.start();
        const result = (await container.wait()) as { StatusCode?: number };
        if (outBuf.length > 0) {
          write(outBuf, "out");
        }
        if (errBuf.length > 0) {
          write(errBuf, "err");
        }
        const exitCode = typeof result.StatusCode === "number" ? result.StatusCode : null;
        if (cancelled) {
          finish("cancelled", exitCode);
          return;
        }
        finish(exitCode === 0 ? "success" : "failed", exitCode);
      } catch (err) {
        if (!exited) {
          write(`[script] sandbox error: ${err instanceof Error ? err.message : String(err)}`, "err");
          finish(cancelled ? "cancelled" : "failed", null);
        }
      }
    }

    void run();
  }

  function triggerTask(task: Task, reason: string): void {
    if (!task.enabled) {
      return;
    }
    const workspace = getWorkspace(task.workspace_id);
    if (workspace === null || workspace.paused) {
      return;
    }
    if (isTaskRunning(task.id)) {
      if (task.concurrency === "parallel") {
        startExecution(task, workspace, reason);
        return;
      }
      if (task.concurrency === "restart") {
        cancelRunningForTask(task.id);
        queued.add(task.id);
        return;
      }
      if (task.concurrency === "queue") {
        queued.add(task.id);
        return;
      }
      return;
    }
    startExecution(task, workspace, reason);
  }

  function unschedule(taskId: string): void {
    const job = cronJobs.get(taskId);
    if (job !== undefined) {
      void job.stop();
      cronJobs.delete(taskId);
    }
  }

  function schedule(task: Task): void {
    unschedule(task.id);
    if (task.trigger_type !== "scheduled" || !task.enabled) {
      return;
    }
    const expr = task.trigger_cron;
    if (expr === null || expr.length === 0 || !cron.validate(expr)) {
      return;
    }
    const job = cron.schedule(expr, () => {
      const fresh = getTask(task.id);
      if (fresh !== null) {
        triggerTask(fresh, `scheduled:${expr}`);
      }
    });
    cronJobs.set(task.id, job);
  }

  db.prepare(
    "UPDATE executions SET status = 'cancelled', ended_at = ? WHERE status IN ('running', 'pending')",
  ).run(Date.now());
  {
    const rows = db.prepare("SELECT * FROM tasks WHERE enabled = 1").all() as TaskRow[];
    for (const row of rows) {
      const task = toTask(row);
      schedule(task);
      if (task.trigger_type === "startup") {
        triggerTask(task, "startup:boot");
      }
    }
  }

  async function requireUser(
    request: FastifyRequest,
  ): Promise<IdentityUser | null> {
    const token = bearerFromRequest(request);
    if (token === null) {
      return null;
    }
    try {
      return await options.identity.verifyAccessToken(token);
    } catch {
      return null;
    }
  }

  app.get("/v1/agent/status", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return {
      online: true,
      info: { hostname: "fookie-cloud", version: "1.0.0", connectedAt: startedAtBoot },
    };
  });

  app.get("/api/v1/stream", { websocket: true }, (socket, request) => {
    void (async () => {
      const user = await requireUser(request);
      if (user === null) {
        socket.close(4401, "unauthorized");
        return;
      }
      let set = sockets.get(user.id);
      if (set === undefined) {
        set = new Set();
        sockets.set(user.id, set);
      }
      set.add(socket);
      socket.send(
        JSON.stringify({ kind: "hello", ts: Date.now(), running: runningSnapshotFor(user.id) }),
      );
      socket.on("close", () => {
        const current = sockets.get(user.id);
        if (current !== undefined) {
          current.delete(socket);
          if (current.size === 0) {
            sockets.delete(user.id);
          }
        }
      });
    })();
  });

  app.get<{ Querystring: { projectId?: string } }>("/api/v1/workspaces", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const projectId = String(request.query.projectId ?? "").trim();
    const rows =
      projectId.length > 0
        ? (db
            .prepare(
              "SELECT * FROM workspaces WHERE owner_id = ? AND project_id = ? ORDER BY created_at ASC",
            )
            .all(user.id, projectId) as WorkspaceRow[])
        : (db
            .prepare("SELECT * FROM workspaces WHERE owner_id = ? ORDER BY created_at ASC")
            .all(user.id) as WorkspaceRow[]);
    return { workspaces: rows.map(toWorkspace) };
  });

  app.post<{ Body: { name?: unknown; projectId?: unknown } }>(
    "/api/v1/workspaces",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      const projectId =
        typeof request.body?.projectId === "string" ? request.body.projectId.trim() : "";
      if (name.length === 0) {
        return reply.code(400).send({ error: "name required" });
      }
      if (projectId.length === 0) {
        return reply.code(400).send({ error: "projectId required" });
      }
      const id = nanoid(12);
      mkdirSync(join(workspacesDir, id), { recursive: true });
      db.prepare(
        "INSERT INTO workspaces (id, owner_id, project_id, name, paused, active_environment_id, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      ).run(id, user.id, projectId, name, Date.now());
      const workspace = getWorkspace(id);
      broadcast(user.id, { kind: "workspace.updated", workspaceId: id });
      return { workspace };
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: unknown } }>(
    "/api/v1/workspaces/:id",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (name.length === 0) {
        return reply.code(400).send({ error: "name required" });
      }
      db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(name, workspace.id);
      broadcast(user.id, { kind: "workspace.updated", workspaceId: workspace.id });
      return { workspace: { ...workspace, name } };
    },
  );

  app.post<{ Params: { id: string } }>("/api/v1/workspaces/:id/pause", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const workspace = getOwnedWorkspace(request.params.id, user);
    if (workspace === null) {
      return reply.code(404).send({ error: "not found" });
    }
    db.prepare("UPDATE workspaces SET paused = 1 WHERE id = ?").run(workspace.id);
    broadcast(user.id, { kind: "workspace.updated", workspaceId: workspace.id });
    return { workspace: { ...workspace, paused: true } };
  });

  app.post<{ Params: { id: string } }>("/api/v1/workspaces/:id/resume", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const workspace = getOwnedWorkspace(request.params.id, user);
    if (workspace === null) {
      return reply.code(404).send({ error: "not found" });
    }
    db.prepare("UPDATE workspaces SET paused = 0 WHERE id = ?").run(workspace.id);
    broadcast(user.id, { kind: "workspace.updated", workspaceId: workspace.id });
    return { workspace: { ...workspace, paused: false } };
  });

  app.delete<{ Params: { id: string } }>("/api/v1/workspaces/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const workspace = getOwnedWorkspace(request.params.id, user);
    if (workspace === null) {
      return reply.code(404).send({ error: "not found" });
    }
    for (const task of listTasks(workspace.id)) {
      unschedule(task.id);
      cancelRunningForTask(task.id);
      queued.delete(task.id);
    }
    db.prepare("DELETE FROM workspaces WHERE id = ?").run(workspace.id);
    const dir = join(workspacesDir, workspace.id);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
    broadcast(user.id, { kind: "workspace.deleted", workspaceId: workspace.id });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/v1/workspaces/:id/export", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const workspace = getOwnedWorkspace(request.params.id, user);
    if (workspace === null) {
      return reply.code(404).send({ error: "not found" });
    }
    const environments = listEnvironments(workspace.id);
    let activeEnvironmentName: string | null = null;
    for (const env of environments) {
      if (env.id === workspace.active_environment_id) {
        activeEnvironmentName = env.name;
      }
    }
    return {
      format: "script-project",
      version: 1,
      exported_at: Date.now(),
      project: {
        name: workspace.name,
        path: "",
        paused: workspace.paused,
        active_environment_name: activeEnvironmentName,
      },
      environments: environments.map((env) => ({ name: env.name, vars: env.vars })),
      tasks: listTasks(workspace.id).map((task) => ({
        name: task.name,
        command: task.command,
        runtime: task.runtime,
        docker_image: task.docker_image,
        docker_platform: task.docker_platform,
        trigger_type: task.trigger_type,
        trigger_glob: task.trigger_glob,
        trigger_cron: task.trigger_cron,
        concurrency: task.concurrency,
        enabled: task.enabled,
      })),
    };
  });

  app.post<{ Body: { bundle?: unknown; name?: unknown; projectId?: unknown } }>(
    "/api/v1/workspaces/import",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const projectId =
        typeof request.body?.projectId === "string" ? request.body.projectId.trim() : "";
      if (projectId.length === 0) {
        return reply.code(400).send({ error: "projectId required" });
      }
      const bundle = request.body?.bundle;
      if (typeof bundle !== "object" || bundle === null) {
        return reply.code(400).send({ error: "bundle required" });
      }
      const bundleRecord = bundle as Record<string, unknown>;
      if (bundleRecord["format"] !== "script-project") {
        return reply.code(400).send({ error: "invalid bundle format" });
      }
      const project = bundleRecord["project"];
      if (typeof project !== "object" || project === null) {
        return reply.code(400).send({ error: "invalid bundle project" });
      }
      const projectRecord = project as Record<string, unknown>;
      let name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (name.length === 0 && typeof projectRecord["name"] === "string") {
        name = projectRecord["name"].trim();
      }
      if (name.length === 0) {
        return reply.code(400).send({ error: "name required" });
      }
      const rawTasks = Array.isArray(bundleRecord["tasks"]) ? bundleRecord["tasks"] : [];
      const parsedTasks: CreateTaskBody[] = [];
      for (const rawTask of rawTasks) {
        const parsed = validateCreateTask(rawTask);
        if (typeof parsed === "string") {
          return reply.code(400).send({ error: parsed });
        }
        parsedTasks.push(parsed);
      }
      const id = nanoid(12);
      mkdirSync(join(workspacesDir, id), { recursive: true });
      db.prepare(
        "INSERT INTO workspaces (id, owner_id, project_id, name, paused, active_environment_id, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      ).run(id, user.id, projectId, name, Date.now());
      const rawEnvironments = Array.isArray(bundleRecord["environments"])
        ? bundleRecord["environments"]
        : [];
      const envIds = new Map<string, string>();
      for (const rawEnv of rawEnvironments) {
        if (typeof rawEnv !== "object" || rawEnv === null) {
          continue;
        }
        const envRecord = rawEnv as Record<string, unknown>;
        if (typeof envRecord["name"] !== "string" || envRecord["name"].length === 0) {
          continue;
        }
        const vars = parseEnvVarsBody(envRecord["vars"]);
        if (typeof vars === "string") {
          continue;
        }
        const envId = nanoid(12);
        try {
          db.prepare(
            "INSERT INTO environments (id, workspace_id, name, vars_json, created_at) VALUES (?, ?, ?, ?, ?)",
          ).run(envId, id, envRecord["name"], JSON.stringify(vars), Date.now());
          envIds.set(envRecord["name"], envId);
        } catch {
          continue;
        }
      }
      const activeName = projectRecord["active_environment_name"];
      if (typeof activeName === "string") {
        const activeId = envIds.get(activeName);
        if (activeId !== undefined) {
          db.prepare("UPDATE workspaces SET active_environment_id = ? WHERE id = ?").run(
            activeId,
            id,
          );
        }
      }
      let taskCount = 0;
      for (const parsed of parsedTasks) {
        const taskId = nanoid(12);
        db.prepare(
          "INSERT INTO tasks (id, workspace_id, name, command, runtime, docker_image, docker_platform, trigger_type, trigger_glob, trigger_cron, concurrency, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          taskId,
          id,
          parsed.name,
          parsed.command,
          parsed.runtime,
          parsed.docker_image,
          parsed.docker_platform,
          parsed.trigger_type,
          parsed.trigger_glob,
          parsed.trigger_cron,
          parsed.concurrency,
          parsed.enabled ? 1 : 0,
          Date.now(),
        );
        const task = getTask(taskId);
        if (task !== null) {
          schedule(task);
        }
        taskCount += 1;
      }
      const workspace = getWorkspace(id);
      broadcast(user.id, { kind: "workspace.updated", workspaceId: id });
      return { workspace, taskCount };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/workspaces/:id/environments",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      return { environments: listEnvironments(workspace.id) };
    },
  );

  app.post<{ Params: { id: string }; Body: { name?: unknown; vars?: unknown } }>(
    "/api/v1/workspaces/:id/environments",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
      if (name.length === 0) {
        return reply.code(400).send({ error: "name required" });
      }
      const vars = parseEnvVarsBody(request.body?.vars);
      if (typeof vars === "string") {
        return reply.code(400).send({ error: vars });
      }
      const id = nanoid(12);
      try {
        db.prepare(
          "INSERT INTO environments (id, workspace_id, name, vars_json, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(id, workspace.id, name, JSON.stringify(vars), Date.now());
      } catch {
        return reply.code(409).send({ error: "environment name already exists" });
      }
      return {
        environment: { id, workspace_id: workspace.id, name, vars, created_at: Date.now() },
      };
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: unknown; vars?: unknown } }>(
    "/api/v1/environments/:id",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(request.params.id) as
        | EnvironmentRow
        | undefined;
      if (row === undefined) {
        return reply.code(404).send({ error: "not found" });
      }
      const workspace = getOwnedWorkspace(row.workspace_id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const existing = toEnvironment(row);
      let nextName = existing.name;
      if (request.body?.name !== undefined) {
        if (typeof request.body.name !== "string" || request.body.name.length === 0) {
          return reply.code(400).send({ error: "name required" });
        }
        nextName = request.body.name;
      }
      let nextVars = existing.vars;
      if (request.body?.vars !== undefined) {
        const vars = parseEnvVarsBody(request.body.vars);
        if (typeof vars === "string") {
          return reply.code(400).send({ error: vars });
        }
        nextVars = vars;
      }
      try {
        db.prepare("UPDATE environments SET name = ?, vars_json = ? WHERE id = ?").run(
          nextName,
          JSON.stringify(nextVars),
          existing.id,
        );
      } catch {
        return reply.code(409).send({ error: "environment name already exists" });
      }
      return { environment: { ...existing, name: nextName, vars: nextVars } };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/environments/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(request.params.id) as
      | EnvironmentRow
      | undefined;
    if (row === undefined) {
      return reply.code(404).send({ error: "not found" });
    }
    const workspace = getOwnedWorkspace(row.workspace_id, user);
    if (workspace === null) {
      return reply.code(404).send({ error: "not found" });
    }
    if (workspace.active_environment_id === row.id) {
      db.prepare("UPDATE workspaces SET active_environment_id = NULL WHERE id = ?").run(
        workspace.id,
      );
      broadcast(user.id, { kind: "workspace.updated", workspaceId: workspace.id });
    }
    db.prepare("DELETE FROM environments WHERE id = ?").run(row.id);
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { environment_id?: unknown } }>(
    "/api/v1/workspaces/:id/active-environment",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      let environmentId: string | null = null;
      const rawId = request.body?.environment_id;
      if (rawId !== undefined && rawId !== null) {
        if (typeof rawId !== "string") {
          return reply.code(400).send({ error: "environment_id must be string or null" });
        }
        const row = db.prepare("SELECT * FROM environments WHERE id = ?").get(rawId) as
          | EnvironmentRow
          | undefined;
        if (row === undefined || row.workspace_id !== workspace.id) {
          return reply.code(404).send({ error: "environment not found" });
        }
        environmentId = row.id;
      }
      db.prepare("UPDATE workspaces SET active_environment_id = ? WHERE id = ?").run(
        environmentId,
        workspace.id,
      );
      broadcast(user.id, { kind: "workspace.updated", workspaceId: workspace.id });
      return { workspace: { ...workspace, active_environment_id: environmentId } };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/v1/workspaces/:id/tasks",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const tasks = listTasks(workspace.id);
      return { tasks, nextCursor: null };
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/workspaces/:id/tasks",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const workspace = getOwnedWorkspace(request.params.id, user);
      if (workspace === null) {
        return reply.code(404).send({ error: "workspace not found" });
      }
      const parsed = validateCreateTask(request.body);
      if (typeof parsed === "string") {
        return reply.code(400).send({ error: parsed });
      }
      const id = nanoid(12);
      db.prepare(
        "INSERT INTO tasks (id, workspace_id, name, command, runtime, docker_image, docker_platform, trigger_type, trigger_glob, trigger_cron, concurrency, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        workspace.id,
        parsed.name,
        parsed.command,
        parsed.runtime,
        parsed.docker_image,
        parsed.docker_platform,
        parsed.trigger_type,
        parsed.trigger_glob,
        parsed.trigger_cron,
        parsed.concurrency,
        parsed.enabled ? 1 : 0,
        Date.now(),
      );
      const task = getTask(id);
      if (task !== null) {
        schedule(task);
        if (task.trigger_type === "startup" && task.enabled) {
          triggerTask(task, "startup:created");
        }
      }
      broadcast(user.id, { kind: "task.updated", taskId: id });
      return { task };
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/tasks/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = getOwnedTask(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    return { task: owned.task };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/tasks/:id",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const owned = getOwnedTask(request.params.id, user);
      if (owned === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const parsed = validateCreateTask(request.body);
      if (typeof parsed === "string") {
        return reply.code(400).send({ error: parsed });
      }
      db.prepare(
        "UPDATE tasks SET name = ?, command = ?, runtime = ?, docker_image = ?, docker_platform = ?, trigger_type = ?, trigger_glob = ?, trigger_cron = ?, concurrency = ?, enabled = ? WHERE id = ?",
      ).run(
        parsed.name,
        parsed.command,
        parsed.runtime,
        parsed.docker_image,
        parsed.docker_platform,
        parsed.trigger_type,
        parsed.trigger_glob,
        parsed.trigger_cron,
        parsed.concurrency,
        parsed.enabled ? 1 : 0,
        owned.task.id,
      );
      const task = getTask(owned.task.id);
      if (task !== null) {
        schedule(task);
      }
      broadcast(user.id, { kind: "task.updated", taskId: owned.task.id });
      return { task };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/tasks/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = getOwnedTask(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    unschedule(owned.task.id);
    cancelRunningForTask(owned.task.id);
    queued.delete(owned.task.id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(owned.task.id);
    broadcast(user.id, { kind: "task.deleted", taskId: owned.task.id });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/v1/tasks/:id/run", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = getOwnedTask(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    if (isTaskRunning(owned.task.id)) {
      return reply.code(409).send({ error: "task already running" });
    }
    triggerTask(owned.task, "manual:user");
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/v1/executions/:id/cancel", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const info = running.get(request.params.id);
    if (info !== undefined) {
      if (info.ownerId !== user.id) {
        return reply.code(404).send({ error: "execution not found" });
      }
      info.cancel();
      return { ok: true };
    }
    const exec = getExecution(request.params.id);
    if (exec === null) {
      return reply.code(404).send({ error: "execution not found" });
    }
    const owned = getOwnedTask(exec.task_id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "execution not found" });
    }
    if (exec.status === "running" || exec.status === "pending") {
      finalizeExecution(exec.id, user.id, "cancelled", null);
    }
    return { ok: true };
  });

  app.get("/api/v1/executions/running", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return { running: runningSnapshotFor(user.id) };
  });

  app.get<{ Querystring: { taskId?: string; limit?: string } }>(
    "/api/v1/executions",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      let limit = 50;
      if (typeof request.query.limit === "string") {
        const n = Number.parseInt(request.query.limit, 10);
        if (Number.isFinite(n) && n > 0 && n <= 500) {
          limit = n;
        }
      }
      if (typeof request.query.taskId === "string" && request.query.taskId.length > 0) {
        const owned = getOwnedTask(request.query.taskId, user);
        if (owned === null) {
          return reply.code(404).send({ error: "not found" });
        }
        const rows = db
          .prepare(
            "SELECT * FROM executions WHERE task_id = ? ORDER BY started_at DESC LIMIT ?",
          )
          .all(owned.task.id, limit) as Execution[];
        return { executions: rows };
      }
      const rows = db
        .prepare(
          `SELECT e.* FROM executions e
           JOIN tasks t ON t.id = e.task_id
           JOIN workspaces w ON w.id = t.workspace_id
           WHERE w.owner_id = ?
           ORDER BY e.started_at DESC LIMIT ?`,
        )
        .all(user.id, limit) as Execution[];
      return { executions: rows };
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/executions/:id/log", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const exec = getExecution(request.params.id);
    if (exec === null) {
      return reply.code(404).send({ error: "not found" });
    }
    const owned = getOwnedTask(exec.task_id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    if (!existsSync(exec.log_path)) {
      return { log: "" };
    }
    return { log: readFileSync(exec.log_path, "utf8") };
  });

  app.addHook("onClose", async () => {
    for (const job of cronJobs.values()) {
      void job.stop();
    }
    cronJobs.clear();
    for (const info of running.values()) {
      info.cancel();
    }
    db.close();
  });
}
