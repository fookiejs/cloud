import Database from "better-sqlite3";
import Docker from "dockerode";
import type { FastifyInstance, FastifyRequest } from "fastify";
import httpProxy from "http-proxy";
import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import type { Socket } from "node:net";
import type { IncomingMessage } from "node:http";
import { userCanAccessProject } from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity, IdentityUser } from "./identity.js";
import { hostProjectDir, projectDir, type ProjectPathsOptions } from "./project-paths.js";

// Deploy runs whatever code is checked out in the project's folder (via the Code /
// git-projects feature) as a long-running, publicly reachable service — the "see my
// idea live" step. Reuses code-server's proven pattern: a per-project Docker
// container, Host-header subdomain routing (path-prefix reverse proxying breaks
// plenty of frameworks' absolute asset/router paths, subdomains never do), self-
// network discovery so it works whether this process runs bare or containerized.
// Unlike code-server this is intentionally PUBLIC — no ticket/session gate — since
// the whole point is a URL you can hand to someone or open on your phone.
export type DeployOptions = ProjectPathsOptions & {
  identity: Identity;
  image: string;
  memoryLimitMb: number;
  cpuLimit: number;
  domain: string | null;
  publicUrl: string;
  // Reads the same per-project env vars script-runner already manages — one place
  // to configure env vars per project, not two.
  scriptDataDir: string;
};

type DeployType = "static" | "node";

type DeploymentRow = {
  project_id: string;
  owner_id: string;
  deploy_type: DeployType;
  start_command: string;
  static_dir: string;
  last_deployed_at: number | null;
  created_at: number;
};

const CONTAINER_PORT = "8080/tcp";
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function containerName(projectId: string): string {
  return `fookie-deploy-${projectId}`;
}

function projectIdFromHost(host: string | undefined, domain: string): string | null {
  if (host === undefined) {
    return null;
  }
  const bareHost = host.split(":")[0]?.toLowerCase() ?? "";
  const suffix = `.${domain}`;
  if (!bareHost.endsWith(suffix)) {
    return null;
  }
  const candidate = bareHost.slice(0, bareHost.length - suffix.length);
  return PROJECT_ID_PATTERN.test(candidate) ? candidate : null;
}

function detectStaticDir(dir: string): string | null {
  for (const candidate of ["", "public", "dist", "build"]) {
    if (existsSync(join(dir, candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

function detect(dir: string): { type: DeployType; staticDir: string } | null {
  if (existsSync(join(dir, "package.json"))) {
    return { type: "node", staticDir: "" };
  }
  const staticDir = detectStaticDir(dir);
  if (staticDir !== null) {
    return { type: "static", staticDir };
  }
  return null;
}

export async function registerDeployModule(app: FastifyInstance, options: DeployOptions): Promise<void> {
  const db = new Database(join(options.dataDir, "deploy.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      project_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      deploy_type TEXT NOT NULL,
      start_command TEXT NOT NULL DEFAULT '',
      static_dir TEXT NOT NULL DEFAULT '',
      last_deployed_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  const docker = new Docker();
  const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true, xfwd: true });
  proxy.on("error", (err) => {
    app.log.error({ err }, "deploy proxy error");
  });

  const domain = options.domain;
  const secure = options.publicUrl.startsWith("https://");

  function getDeployment(projectId: string): DeploymentRow | null {
    const row = db.prepare("SELECT * FROM deployments WHERE project_id = ?").get(projectId) as
      | DeploymentRow
      | undefined;
    return row === undefined ? null : row;
  }

  function activeEnvVars(projectId: string): Record<string, string> {
    try {
      const scriptDb = new Database(join(options.scriptDataDir, "script.db"), { readonly: true });
      try {
        const settings = scriptDb
          .prepare("SELECT active_environment_id FROM project_settings WHERE project_id = ?")
          .get(projectId) as { active_environment_id: string | null } | undefined;
        if (settings === undefined || settings.active_environment_id === null) {
          return {};
        }
        const env = scriptDb
          .prepare("SELECT vars_json FROM environments WHERE id = ?")
          .get(settings.active_environment_id) as { vars_json: string } | undefined;
        if (env === undefined) {
          return {};
        }
        const parsed: unknown = JSON.parse(env.vars_json);
        if (typeof parsed !== "object" || parsed === null) {
          return {};
        }
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "string") {
            out[key] = value;
          }
        }
        return out;
      } finally {
        scriptDb.close();
      }
    } catch {
      return {};
    }
  }

  let selfNetworks: string[] | null = null;
  async function resolveSelfNetworks(): Promise<string[]> {
    if (selfNetworks !== null) {
      return selfNetworks;
    }
    try {
      const info = await docker.getContainer(hostname()).inspect();
      selfNetworks = Object.keys(info.NetworkSettings.Networks).filter((name) => name !== "fookie-obs");
    } catch {
      selfNetworks = [];
    }
    return selfNetworks;
  }

  async function resolveTarget(projectId: string): Promise<string | null> {
    const container = docker.getContainer(containerName(projectId));
    let info: Docker.ContainerInspectInfo;
    try {
      info = await container.inspect();
    } catch {
      return null;
    }
    if (!info.State.Running) {
      return null;
    }
    const networks = await resolveSelfNetworks();
    if (networks.length > 0) {
      return `http://${containerName(projectId)}:8080`;
    }
    const bindings = info.NetworkSettings.Ports[CONTAINER_PORT];
    const hostPort = bindings?.[0]?.HostPort;
    return hostPort === undefined ? null : `http://127.0.0.1:${hostPort}`;
  }

  async function recreateContainer(
    projectId: string,
    deployment: DeploymentRow,
  ): Promise<void> {
    const name = containerName(projectId);
    const existing = docker.getContainer(name);
    try {
      await existing.remove({ force: true });
    } catch {
      // wasn't running — fine
    }
    try {
      await docker.getImage(options.image).inspect();
    } catch {
      const stream = await docker.pull(options.image, {});
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(stream, (err: Error | null) => {
          if (err === null) resolve();
          else reject(err);
        });
      });
    }
    const command =
      deployment.deploy_type === "static"
        ? `npx --yes serve -s ${deployment.static_dir.length > 0 ? deployment.static_dir : "."} -l 8080`
        : deployment.start_command.length > 0
          ? deployment.start_command
          : "npm install && npm start";
    const customEnv = activeEnvVars(projectId);
    const env = Object.entries({ ...customEnv, PORT: "8080" }).map(([key, value]) => `${key}=${value}`);
    const networks = await resolveSelfNetworks();
    const hostConfig: Docker.HostConfig = {
      Binds: [`${hostProjectDir(options, projectId)}:/app:rw`],
      RestartPolicy: { Name: "unless-stopped" },
      Memory: options.memoryLimitMb * 1024 * 1024,
      NanoCpus: Math.round(options.cpuLimit * 1_000_000_000),
    };
    if (networks.length > 0) {
      hostConfig.NetworkMode = networks[0];
    } else {
      hostConfig.PortBindings = { [CONTAINER_PORT]: [{ HostPort: "0" }] };
    }
    const container = await docker.createContainer({
      name,
      Image: options.image,
      Cmd: ["sh", "-c", command],
      WorkingDir: "/app",
      Env: env,
      ExposedPorts: { [CONTAINER_PORT]: {} },
      HostConfig: hostConfig,
    });
    await container.start();
    db.prepare("UPDATE deployments SET last_deployed_at = ? WHERE project_id = ?").run(
      Date.now(),
      projectId,
    );
  }

  async function requireProjectAccess(request: FastifyRequest, projectId: string): Promise<IdentityUser | null> {
    const user = await options.identity.userFrom(request);
    if (user === null) {
      return null;
    }
    if (!userCanAccessProject(projectId, user.id)) {
      return null;
    }
    return user;
  }

  function publicUrlFor(projectId: string): string {
    const scheme = secure ? "https" : "http";
    return `${scheme}://${projectId}.${domain ?? ""}/`;
  }

  app.get<{ Params: { projectId: string } }>("/api/v1/projects/:projectId/deploy", async (request, reply) => {
    const user = await requireProjectAccess(request, request.params.projectId);
    if (user === null) {
      return reply.code(404).send({ error: "not found" });
    }
    const deployment = getDeployment(request.params.projectId);
    if (deployment === null) {
      return { deployed: false, configured: domain !== null };
    }
    let running = false;
    try {
      const info = await docker.getContainer(containerName(request.params.projectId)).inspect();
      running = info.State.Running;
    } catch {
      running = false;
    }
    return {
      deployed: true,
      running,
      deployType: deployment.deploy_type,
      lastDeployedAt: deployment.last_deployed_at,
      url: domain !== null ? publicUrlFor(request.params.projectId) : null,
    };
  });

  app.post<{ Params: { projectId: string }; Body: { startCommand?: unknown } }>(
    "/api/v1/projects/:projectId/deploy/start",
    async (request, reply) => {
      if (domain === null) {
        return reply.code(503).send({ error: "deploy is not configured on this server" });
      }
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const dir = projectDir(options, request.params.projectId);
      const detected = detect(dir);
      if (detected === null) {
        return reply.code(422).send({
          error: "couldn't detect how to run this project — add a package.json (Node) or an index.html (static)",
        });
      }
      const startCommand =
        typeof request.body?.startCommand === "string" ? request.body.startCommand.trim() : "";
      const existing = getDeployment(request.params.projectId);
      const row: DeploymentRow = {
        project_id: request.params.projectId,
        owner_id: user.id,
        deploy_type: detected.type,
        start_command: startCommand,
        static_dir: detected.staticDir,
        last_deployed_at: existing?.last_deployed_at ?? null,
        created_at: existing?.created_at ?? Date.now(),
      };
      db.prepare(
        `INSERT INTO deployments (project_id, owner_id, deploy_type, start_command, static_dir, last_deployed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           deploy_type = excluded.deploy_type,
           start_command = excluded.start_command,
           static_dir = excluded.static_dir`,
      ).run(row.project_id, row.owner_id, row.deploy_type, row.start_command, row.static_dir, row.last_deployed_at, row.created_at);
      try {
        await recreateContainer(request.params.projectId, row);
      } catch (err) {
        return reply.code(502).send({
          error: `deploy failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      let ready = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const target = await resolveTarget(request.params.projectId);
        if (target !== null) {
          try {
            const res = await fetch(target);
            if (res.status < 500) {
              ready = true;
              break;
            }
          } catch {
            // still starting
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!ready) {
        return reply.code(504).send({ error: "deployment did not become ready in time — check logs" });
      }
      return { ok: true, url: publicUrlFor(request.params.projectId) };
    },
  );

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/deploy/redeploy",
    async (request, reply) => {
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      const deployment = getDeployment(request.params.projectId);
      if (deployment === null) {
        return reply.code(409).send({ error: "not deployed yet" });
      }
      try {
        await recreateContainer(request.params.projectId, deployment);
      } catch (err) {
        return reply.code(502).send({
          error: `redeploy failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return { ok: true };
    },
  );

  app.post<{ Params: { projectId: string } }>("/api/v1/projects/:projectId/deploy/stop", async (request, reply) => {
    const user = await requireProjectAccess(request, request.params.projectId);
    if (user === null) {
      return reply.code(404).send({ error: "not found" });
    }
    try {
      await docker.getContainer(containerName(request.params.projectId)).stop();
    } catch {
      // already stopped/missing — fine
    }
    return { ok: true };
  });

  app.get<{ Params: { projectId: string } }>("/api/v1/projects/:projectId/deploy/logs", async (request, reply) => {
    const user = await requireProjectAccess(request, request.params.projectId);
    if (user === null) {
      return reply.code(404).send({ error: "not found" });
    }
    try {
      const container = docker.getContainer(containerName(request.params.projectId));
      const buffer = (await container.logs({
        stdout: true,
        stderr: true,
        tail: 200,
        timestamps: false,
      })) as unknown as Buffer;
      // Docker's log stream multiplexes stdout/stderr with an 8-byte frame header per
      // chunk when not using a TTY — strip it so logs read as plain text.
      const lines: string[] = [];
      let offset = 0;
      while (offset + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(offset + 4);
        const start = offset + 8;
        const end = Math.min(start + size, buffer.length);
        lines.push(buffer.toString("utf8", start, end));
        offset = end;
      }
      return { log: lines.join("") };
    } catch (err) {
      return reply.code(404).send({ error: err instanceof Error ? err.message : "no logs" });
    }
  });

  if (domain === null) {
    return;
  }

  app.addHook("onRequest", async (request, reply) => {
    const projectId = projectIdFromHost(request.headers.host, domain);
    if (projectId === null) {
      return;
    }
    const target = await resolveTarget(projectId);
    if (target === null) {
      return reply.code(503).send("this deployment isn't running");
    }
    reply.hijack();
    proxy.web(request.raw, reply.raw, { target });
  });

  app.server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const projectId = projectIdFromHost(req.headers.host, domain);
    if (projectId === null) {
      return;
    }
    void (async () => {
      const target = await resolveTarget(projectId);
      if (target === null) {
        socket.destroy();
        return;
      }
      proxy.ws(req, socket, head, { target });
    })();
  });
}
