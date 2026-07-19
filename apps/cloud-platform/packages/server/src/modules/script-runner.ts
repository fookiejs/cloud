import Database from "better-sqlite3";
import Docker from "dockerode";
import cron, { type ScheduledTask } from "node-cron";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { nanoid } from "nanoid";
import type { WebSocket } from "ws";
import { z } from "zod";
import { userCanAccessProject } from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity, IdentityUser } from "./identity.js";
import { hostProjectDir, projectDir } from "./project-paths.js";

type RuntimeKind = "shell" | "docker";
type TriggerKind = "save" | "manual" | "startup" | "scheduled";
type ConcurrencyKind = "restart" | "queue" | "ignore" | "parallel";
type ExecutionStatus = "pending" | "running" | "success" | "failed" | "cancelled";

type ProjectSettings = {
  project_id: string;
  owner_id: string;
  paused: boolean;
  active_environment_id: string | null;
  created_at: number;
};

type Environment = {
  id: string;
  project_id: string;
  name: string;
  vars: Record<string, string>;
  created_at: number;
};

type Script = {
  id: string;
  project_id: string;
  name: string;
  command: string;
  runtime: RuntimeKind;
  // Empty string means "unset" — these are optional depending on runtime/trigger_type,
  // not absent data, so there is no NULL state to represent.
  docker_image: string;
  docker_platform: string;
  trigger_type: TriggerKind;
  trigger_glob: string;
  trigger_cron: string;
  concurrency: ConcurrencyKind;
  enabled: boolean;
  created_at: number;
};

type Execution = {
  id: string;
  script_id: string;
  status: ExecutionStatus;
  started_at: number | null;
  ended_at: number | null;
  exit_code: number | null;
  trigger_reason: string;
  log_path: string;
};

type ServerMessage =
  | { kind: "execution.started"; executionId: string; scriptId: string; ts: number }
  | { kind: "execution.log"; executionId: string; line: string; stream: "out" | "err"; ts: number }
  | {
      kind: "execution.ended";
      executionId: string;
      status: ExecutionStatus;
      exitCode: number | null;
      ts: number;
    }
  | { kind: "script.updated"; scriptId: string }
  | { kind: "script.deleted"; scriptId: string }
  | { kind: "project.updated"; projectId: string }
  | {
      kind: "hello";
      ts: number;
      running: { executionId: string; scriptId: string; startedAt: number }[];
    };

export type ScriptRunnerOptions = {
  identity: Identity;
  dataDir: string;
  workspacesHostDir: string | null;
  sandboxImage: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS project_settings (
  project_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  active_environment_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vars_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  runtime TEXT NOT NULL,
  docker_image TEXT NOT NULL DEFAULT '',
  docker_platform TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL,
  trigger_glob TEXT NOT NULL DEFAULT '',
  trigger_cron TEXT NOT NULL DEFAULT '',
  concurrency TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scripts_project ON scripts(project_id, owner_id);
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  exit_code INTEGER,
  trigger_reason TEXT NOT NULL,
  log_path TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_executions_script ON executions(script_id, started_at DESC);
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

type CreateScriptBody = {
  name: string;
  command: string;
  runtime: RuntimeKind;
  docker_image: string;
  docker_platform: string;
  trigger_type: TriggerKind;
  trigger_glob: string;
  trigger_cron: string;
  concurrency: ConcurrencyKind;
  enabled: boolean;
};

function optionalString(raw: unknown): string | "invalid" {
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw !== "string") {
    return "invalid";
  }
  return raw;
}

function validateCreateScript(body: unknown): CreateScriptBody | string {
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
    return "docker_image must be a string";
  }
  const dockerPlatform = optionalString(b["docker_platform"]);
  if (dockerPlatform === "invalid") {
    return "docker_platform must be a string";
  }
  const triggerGlob = optionalString(b["trigger_glob"]);
  if (triggerGlob === "invalid") {
    return "trigger_glob must be a string";
  }
  const triggerCron = optionalString(b["trigger_cron"]);
  if (triggerCron === "invalid") {
    return "trigger_cron must be a string";
  }
  if (b["trigger_type"] === "scheduled") {
    if (triggerCron.length === 0 || !cron.validate(triggerCron)) {
      return "valid trigger_cron required for scheduled scripts";
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
  const projectsDir = join(options.dataDir, "workspaces");
  const logsDir = join(options.dataDir, "logs");
  mkdirSync(projectsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const db = new Database(join(options.dataDir, "script.db"));
  db.pragma("journal_mode = WAL");
  // Pre-rewrite DBs used a "workspaces" table and/or named the scripts table "tasks",
  // both with nullable optional-string columns. Drop the old shape rather than
  // migrating it — neither the workspace indirection nor the nulls carry meaning
  // this schema needs.
  const legacyTableNames = ["workspaces", "tasks"];
  const hasLegacyTable = legacyTableNames.some(
    (name) =>
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(name) !== undefined,
  );
  if (hasLegacyTable) {
    db.exec(
      "DROP TABLE IF EXISTS executions; DROP TABLE IF EXISTS scripts; DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS environments; DROP TABLE IF EXISTS workspaces;",
    );
  }
  db.exec(SCHEMA);

  const docker = new Docker();
  const memoryLimitMb = Number(process.env.SCRIPT_MEMORY_LIMIT_MB ?? 1024);
  const cpuLimit = Number(process.env.SCRIPT_CPU_LIMIT ?? 1);
  const startedAtBoot = Date.now();

  type ProjectSettingsRow = {
    project_id: string;
    owner_id: string;
    paused: number;
    active_environment_id: string | null;
    created_at: number;
  };
  type EnvironmentRow = {
    id: string;
    project_id: string;
    name: string;
    vars_json: string;
    created_at: number;
  };
  type ScriptRow = {
    id: string;
    project_id: string;
    owner_id: string;
    name: string;
    command: string;
    runtime: string;
    docker_image: string;
    docker_platform: string;
    trigger_type: string;
    trigger_glob: string;
    trigger_cron: string;
    concurrency: string;
    enabled: number;
    created_at: number;
  };

  function toProjectSettings(row: ProjectSettingsRow): ProjectSettings {
    return {
      project_id: row.project_id,
      owner_id: row.owner_id,
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
      project_id: row.project_id,
      name: row.name,
      vars,
      created_at: row.created_at,
    };
  }

  function toScript(row: ScriptRow): Script {
    return {
      id: row.id,
      project_id: row.project_id,
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

  function getOrCreateProjectSettings(projectId: string, ownerId: string): ProjectSettings {
    const row = db
      .prepare("SELECT * FROM project_settings WHERE project_id = ?")
      .get(projectId) as ProjectSettingsRow | undefined;
    if (row !== undefined) {
      return toProjectSettings(row);
    }
    db.prepare(
      "INSERT INTO project_settings (project_id, owner_id, paused, active_environment_id, created_at) VALUES (?, ?, 0, NULL, ?)",
    ).run(projectId, ownerId, Date.now());
    mkdirSync(projectDir(options, projectId), { recursive: true });
    return {
      project_id: projectId,
      owner_id: ownerId,
      paused: false,
      active_environment_id: null,
      created_at: Date.now(),
    };
  }

  function getProjectSettings(projectId: string): ProjectSettings | null {
    const row = db
      .prepare("SELECT * FROM project_settings WHERE project_id = ?")
      .get(projectId) as ProjectSettingsRow | undefined;
    return row === undefined ? null : toProjectSettings(row);
  }

  // Every route entered through this checks real project ownership via task-bridge's
  // project registry, not just a locally-stored owner_id column.
  async function requireProjectAccess(
    projectId: string,
    user: IdentityUser,
  ): Promise<ProjectSettings | null> {
    if (!userCanAccessProject(projectId, user.id)) {
      return null;
    }
    return getOrCreateProjectSettings(projectId, user.id);
  }

  function getScript(id: string): Script | null {
    const row = db.prepare("SELECT * FROM scripts WHERE id = ?").get(id) as ScriptRow | undefined;
    return row === undefined ? null : toScript(row);
  }

  async function getOwnedScript(
    id: string,
    user: IdentityUser,
  ): Promise<{ script: Script; project: ProjectSettings } | null> {
    const script = getScript(id);
    if (script === null) {
      return null;
    }
    if (!userCanAccessProject(script.project_id, user.id)) {
      return null;
    }
    const project = getProjectSettings(script.project_id);
    if (project === null) {
      return null;
    }
    return { script, project };
  }

  function getExecution(id: string): Execution | null {
    const row = db.prepare("SELECT * FROM executions WHERE id = ?").get(id) as
      | Execution
      | undefined;
    return row === undefined ? null : { ...row, status: row.status };
  }

  function listEnvironments(projectId: string): Environment[] {
    const rows = db
      .prepare("SELECT * FROM environments WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as EnvironmentRow[];
    return rows.map(toEnvironment);
  }

  function listScripts(projectId: string): Script[] {
    const rows = db
      .prepare("SELECT * FROM scripts WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as ScriptRow[];
    return rows.map(toScript);
  }

  function resolveActiveEnvVars(project: ProjectSettings): Record<string, string> {
    if (project.active_environment_id === null) {
      return {};
    }
    const row = db
      .prepare("SELECT * FROM environments WHERE id = ?")
      .get(project.active_environment_id) as EnvironmentRow | undefined;
    if (row === undefined) {
      return {};
    }
    return toEnvironment(row).vars;
  }

  const sockets = new Map<string, Set<WebSocket>>();
  const running = new Map<
    string,
    { scriptId: string; ownerId: string; projectId: string; startedAt: number; cancel: () => void }
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

  function runningSnapshotFor(
    ownerId: string,
    projectId?: string,
  ): { executionId: string; scriptId: string; startedAt: number }[] {
    const out: { executionId: string; scriptId: string; startedAt: number }[] = [];
    for (const [executionId, info] of running.entries()) {
      if (info.ownerId !== ownerId) {
        continue;
      }
      if (projectId !== undefined && info.projectId !== projectId) {
        continue;
      }
      out.push({ executionId, scriptId: info.scriptId, startedAt: info.startedAt });
    }
    return out;
  }

  function hostProjectPath(projectId: string): string {
    return hostProjectDir(options, projectId);
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

  function isScriptRunning(scriptId: string): boolean {
    for (const info of running.values()) {
      if (info.scriptId === scriptId) {
        return true;
      }
    }
    return false;
  }

  function cancelRunningForScript(scriptId: string): void {
    for (const info of running.values()) {
      if (info.scriptId === scriptId) {
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
    const script = getScript(exec.script_id);
    if (script !== null && queued.delete(script.id)) {
      triggerScript(script, "queue:drain");
    }
  }

  function startExecution(script: Script, project: ProjectSettings, reason: string): void {
    const executionId = nanoid(12);
    const now = Date.now();
    const logPath = join(logsDir, `${executionId}.log`);
    db.prepare(
      "INSERT INTO executions (id, script_id, status, started_at, ended_at, exit_code, trigger_reason, log_path) VALUES (?, ?, 'running', ?, NULL, NULL, ?, ?)",
    ).run(executionId, script.id, now, reason, logPath);
    broadcast(project.owner_id, {
      kind: "execution.started",
      executionId,
      scriptId: script.id,
      ts: now,
    });

    const logFile = createWriteStream(logPath, { flags: "a", encoding: "utf8" });
    let cancelled = false;
    let exited = false;
    let container: Docker.Container | null = null;

    function write(line: string, stream: "out" | "err"): void {
      const clean = line.replace(/\r$/, "");
      logFile.write(`${stream}\t${clean}\n`);
      broadcast(project.owner_id, {
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
      finalizeExecution(executionId, project.owner_id, status, exitCode);
    }

    running.set(executionId, {
      scriptId: script.id,
      ownerId: project.owner_id,
      projectId: script.project_id,
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
      script.runtime === "docker" && script.docker_image.length > 0
        ? script.docker_image
        : options.sandboxImage;

    async function run(): Promise<void> {
      try {
        try {
          await docker.getImage(image).inspect();
        } catch {
          write(`[script] pulling ${image}...`, "out");
          const pullOpts: { platform?: string } = {};
          if (script.docker_platform.length > 0) {
            pullOpts.platform = script.docker_platform;
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

        const customEnv = resolveActiveEnvVars(project);
        write(`[script] sandbox image=${image} project=${script.project_id}`, "out");

        const createOpts: Docker.ContainerCreateOptions = {
          Image: image,
          Cmd: ["/bin/sh", "-c", script.command],
          WorkingDir: "/workspace",
          Env: sandboxEnv(customEnv),
          Tty: false,
          HostConfig: {
            AutoRemove: true,
            Binds: [`${hostProjectPath(script.project_id)}:/workspace:rw`],
            Memory: memoryLimitMb * 1024 * 1024,
            NanoCpus: Math.round(cpuLimit * 1_000_000_000),
            PidsLimit: 512,
            SecurityOpt: ["no-new-privileges"],
            NetworkMode: "bridge",
          },
        };
        if (script.docker_platform.length > 0) {
          createOpts.platform = script.docker_platform;
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

  function triggerScript(script: Script, reason: string): void {
    if (!script.enabled) {
      return;
    }
    const project = getProjectSettings(script.project_id);
    if (project === null || project.paused) {
      return;
    }
    if (isScriptRunning(script.id)) {
      if (script.concurrency === "parallel") {
        startExecution(script, project, reason);
        return;
      }
      if (script.concurrency === "restart") {
        cancelRunningForScript(script.id);
        queued.add(script.id);
        return;
      }
      if (script.concurrency === "queue") {
        queued.add(script.id);
        return;
      }
      return;
    }
    startExecution(script, project, reason);
  }

  function unschedule(scriptId: string): void {
    const job = cronJobs.get(scriptId);
    if (job !== undefined) {
      void job.stop();
      cronJobs.delete(scriptId);
    }
  }

  function schedule(script: Script): void {
    unschedule(script.id);
    if (script.trigger_type !== "scheduled" || !script.enabled) {
      return;
    }
    const expr = script.trigger_cron;
    if (expr.length === 0 || !cron.validate(expr)) {
      return;
    }
    const job = cron.schedule(expr, () => {
      const fresh = getScript(script.id);
      if (fresh !== null) {
        triggerScript(fresh, `scheduled:${expr}`);
      }
    });
    cronJobs.set(script.id, job);
  }

  db.prepare(
    "UPDATE executions SET status = 'cancelled', ended_at = ? WHERE status IN ('running', 'pending')",
  ).run(Date.now());
  {
    const rows = db.prepare("SELECT * FROM scripts WHERE enabled = 1").all() as ScriptRow[];
    for (const row of rows) {
      const script = toScript(row);
      schedule(script);
      if (script.trigger_type === "startup") {
        triggerScript(script, "startup:boot");
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

  // Single project-scoped snapshot route: settings + environments + scripts + recent
  // executions for every script in the project, in one round trip. Replaces the old
  // workspace-fetch -> per-script-execution-fetch waterfall.
  app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>(
    "/api/v1/projects/:projectId/script-snapshot",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      // Per-script recent history, not a single project-wide LIMIT — otherwise a
      // chatty script would crowd quieter scripts out of the initial snapshot.
      let perScriptLimit = 20;
      if (typeof request.query.limit === "string") {
        const n = Number.parseInt(request.query.limit, 10);
        if (Number.isFinite(n) && n > 0 && n <= 200) {
          perScriptLimit = n;
        }
      }
      const scripts = listScripts(project.project_id);
      const executions =
        scripts.length === 0
          ? []
          : (db
              .prepare(
                `SELECT id, script_id, status, started_at, ended_at, exit_code, trigger_reason, log_path
                 FROM (
                   SELECT e.*, ROW_NUMBER() OVER (
                     PARTITION BY e.script_id ORDER BY e.started_at DESC
                   ) AS rn
                   FROM executions e
                   JOIN scripts t ON t.id = e.script_id
                   WHERE t.project_id = ?
                 )
                 WHERE rn <= ?
                 ORDER BY started_at DESC`,
              )
              .all(project.project_id, perScriptLimit) as Execution[]);
      return {
        settings: project,
        environments: listEnvironments(project.project_id),
        scripts,
        executions,
        running: runningSnapshotFor(user.id, project.project_id),
      };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/export",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const environments = listEnvironments(project.project_id);
      let activeEnvironmentName: string | null = null;
      for (const env of environments) {
        if (env.id === project.active_environment_id) {
          activeEnvironmentName = env.name;
        }
      }
      return {
        format: "script-project",
        version: 1,
        exported_at: Date.now(),
        project: {
          name: project.project_id,
          path: "",
          paused: project.paused,
          active_environment_name: activeEnvironmentName,
        },
        environments: environments.map((env) => ({ name: env.name, vars: env.vars })),
        scripts: listScripts(project.project_id).map((script) => ({
          name: script.name,
          command: script.command,
          runtime: script.runtime,
          docker_image: script.docker_image,
          docker_platform: script.docker_platform,
          trigger_type: script.trigger_type,
          trigger_glob: script.trigger_glob,
          trigger_cron: script.trigger_cron,
          concurrency: script.concurrency,
          enabled: script.enabled,
        })),
      };
    },
  );

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/pause",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      db.prepare("UPDATE project_settings SET paused = 1 WHERE project_id = ?").run(
        project.project_id,
      );
      broadcast(user.id, { kind: "project.updated", projectId: project.project_id });
      return { settings: { ...project, paused: true } };
    },
  );

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/resume",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      db.prepare("UPDATE project_settings SET paused = 0 WHERE project_id = ?").run(
        project.project_id,
      );
      broadcast(user.id, { kind: "project.updated", projectId: project.project_id });
      return { settings: { ...project, paused: false } };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/environments",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      return { environments: listEnvironments(project.project_id) };
    },
  );

  app.post<{ Params: { projectId: string }; Body: { name?: unknown; vars?: unknown } }>(
    "/api/v1/projects/:projectId/environments",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
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
          "INSERT INTO environments (id, project_id, name, vars_json, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(id, project.project_id, name, JSON.stringify(vars), Date.now());
      } catch {
        return reply.code(409).send({ error: "environment name already exists" });
      }
      return {
        environment: { id, project_id: project.project_id, name, vars, created_at: Date.now() },
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
      if (row === undefined || !userCanAccessProject(row.project_id, user.id)) {
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
    if (row === undefined || !userCanAccessProject(row.project_id, user.id)) {
      return reply.code(404).send({ error: "not found" });
    }
    const project = getProjectSettings(row.project_id);
    if (project !== null && project.active_environment_id === row.id) {
      db.prepare("UPDATE project_settings SET active_environment_id = NULL WHERE project_id = ?").run(
        project.project_id,
      );
      broadcast(user.id, { kind: "project.updated", projectId: row.project_id });
    }
    db.prepare("DELETE FROM environments WHERE id = ?").run(row.id);
    return { ok: true };
  });

  app.patch<{ Params: { projectId: string }; Body: { environment_id?: unknown } }>(
    "/api/v1/projects/:projectId/active-environment",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
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
        if (row === undefined || row.project_id !== project.project_id) {
          return reply.code(404).send({ error: "environment not found" });
        }
        environmentId = row.id;
      }
      db.prepare("UPDATE project_settings SET active_environment_id = ? WHERE project_id = ?").run(
        environmentId,
        project.project_id,
      );
      broadcast(user.id, { kind: "project.updated", projectId: project.project_id });
      return { settings: { ...project, active_environment_id: environmentId } };
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/scripts",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      return { scripts: listScripts(project.project_id), nextCursor: null };
    },
  );

  app.post<{ Params: { projectId: string }; Body: unknown }>(
    "/api/v1/projects/:projectId/scripts",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const project = await requireProjectAccess(request.params.projectId, user);
      if (project === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const parsed = validateCreateScript(request.body);
      if (typeof parsed === "string") {
        return reply.code(400).send({ error: parsed });
      }
      const id = nanoid(12);
      db.prepare(
        "INSERT INTO scripts (id, project_id, owner_id, name, command, runtime, docker_image, docker_platform, trigger_type, trigger_glob, trigger_cron, concurrency, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        project.project_id,
        user.id,
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
      const script = getScript(id);
      if (script !== null) {
        schedule(script);
        if (script.trigger_type === "startup" && script.enabled) {
          triggerScript(script, "startup:created");
        }
      }
      broadcast(user.id, { kind: "script.updated", scriptId: id });
      return { script };
    },
  );

  app.get<{ Params: { id: string } }>("/api/v1/scripts/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = await getOwnedScript(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    return { script: owned.script };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/scripts/:id",
    async (request, reply) => {
      const user = await requireUser(request);
      if (user === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      const owned = await getOwnedScript(request.params.id, user);
      if (owned === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const parsed = validateCreateScript(request.body);
      if (typeof parsed === "string") {
        return reply.code(400).send({ error: parsed });
      }
      db.prepare(
        "UPDATE scripts SET name = ?, command = ?, runtime = ?, docker_image = ?, docker_platform = ?, trigger_type = ?, trigger_glob = ?, trigger_cron = ?, concurrency = ?, enabled = ? WHERE id = ?",
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
        owned.script.id,
      );
      const script = getScript(owned.script.id);
      if (script !== null) {
        schedule(script);
      }
      broadcast(user.id, { kind: "script.updated", scriptId: owned.script.id });
      return { script };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/v1/scripts/:id", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = await getOwnedScript(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    unschedule(owned.script.id);
    cancelRunningForScript(owned.script.id);
    queued.delete(owned.script.id);
    db.prepare("DELETE FROM scripts WHERE id = ?").run(owned.script.id);
    broadcast(user.id, { kind: "script.deleted", scriptId: owned.script.id });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/v1/scripts/:id/run", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const owned = await getOwnedScript(request.params.id, user);
    if (owned === null) {
      return reply.code(404).send({ error: "not found" });
    }
    if (isScriptRunning(owned.script.id)) {
      return reply.code(409).send({ error: "script already running" });
    }
    triggerScript(owned.script, "manual:user");
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
    const owned = await getOwnedScript(exec.script_id, user);
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

  app.get<{ Querystring: { scriptId?: string; limit?: string } }>(
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
      if (typeof request.query.scriptId !== "string" || request.query.scriptId.length === 0) {
        return reply.code(400).send({ error: "scriptId required" });
      }
      const owned = await getOwnedScript(request.query.scriptId, user);
      if (owned === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const rows = db
        .prepare("SELECT * FROM executions WHERE script_id = ? ORDER BY started_at DESC LIMIT ?")
        .all(owned.script.id, limit) as Execution[];
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
    const owned = await getOwnedScript(exec.script_id, user);
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
