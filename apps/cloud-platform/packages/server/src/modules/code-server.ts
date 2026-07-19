import Docker from "dockerode";
import type { FastifyInstance, FastifyRequest } from "fastify";
import httpProxy from "http-proxy";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import type { Socket } from "node:net";
import type { IncomingMessage } from "node:http";
import { userCanAccessProject } from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity, IdentityUser } from "./identity.js";
import { hostProjectDir, type ProjectPathsOptions } from "./project-paths.js";

// code-server's own web UI is only officially supported at the root path or on a
// distinct host — path-prefix reverse proxying breaks its asset/service-worker/ws
// paths. So each project's IDE is served on its own subdomain
// (`<projectId>.<codeServerDomain>`) instead of a path under the main app, routed by
// Host header from this same process/port.
export type CodeServerOptions = ProjectPathsOptions & {
  identity: Identity;
  image: string;
  // e.g. "code.fookiecloud.com" -> IDE served at "<projectId>.code.fookiecloud.com".
  // Feature is disabled entirely when this is null.
  domain: string | null;
  publicUrl: string;
};

const CONTAINER_PORT = "8080/tcp";
const TICKET_TTL_MS = 60_000;
const COOKIE_TTL_SECONDS = 12 * 60 * 60;
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function containerName(projectId: string): string {
  return `fookie-code-${projectId}`;
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

function parseCookies(header: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (header === undefined) {
    return out;
  }
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      out.set(part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim()));
    }
  }
  return out;
}

export async function registerCodeServerModule(
  app: FastifyInstance,
  options: CodeServerOptions,
): Promise<void> {
  const docker = new Docker();
  const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true, xfwd: true });
  proxy.on("error", (err) => {
    app.log.error({ err }, "code-server proxy error");
  });

  const domain = options.domain;
  const secure = options.publicUrl.startsWith("https://");

  // Single-use ticket minted by /ide/start, redeemed once on the IDE subdomain to set
  // a session cookie — the IDE origin has no way to see the SPA's bearer token, so
  // this is the handoff. Sessions map is the "logged in on this subdomain" record.
  const tickets = new Map<string, { projectId: string; expiresAt: number }>();
  const sessions = new Map<string, { projectId: string; expiresAt: number }>();
  function sweep(): void {
    const now = Date.now();
    for (const [key, entry] of tickets) {
      if (entry.expiresAt < now) tickets.delete(key);
    }
    for (const [key, entry] of sessions) {
      if (entry.expiresAt < now) sessions.delete(key);
    }
  }

  let selfNetworks: string[] | null = null;
  async function resolveSelfNetworks(): Promise<string[]> {
    if (selfNetworks !== null) {
      return selfNetworks;
    }
    try {
      const info = await docker.getContainer(hostname()).inspect();
      selfNetworks = Object.keys(info.NetworkSettings.Networks);
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
    if (hostPort === undefined) {
      return null;
    }
    return `http://127.0.0.1:${hostPort}`;
  }

  async function ensureContainer(projectId: string): Promise<void> {
    const name = containerName(projectId);
    const existing = docker.getContainer(name);
    try {
      const info = await existing.inspect();
      if (!info.State.Running) {
        await existing.start();
      }
      return;
    } catch {
      // not found — fall through to create
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
    const networks = await resolveSelfNetworks();
    const hostConfig: Docker.HostConfig = {
      Binds: [`${hostProjectDir(options, projectId)}:/home/coder/project:rw`],
      RestartPolicy: { Name: "unless-stopped" },
    };
    if (networks.length > 0) {
      hostConfig.NetworkMode = networks[0];
    } else {
      hostConfig.PortBindings = { [CONTAINER_PORT]: [{ HostPort: "0" }] };
    }
    const container = await docker.createContainer({
      name,
      Image: options.image,
      Cmd: ["--auth", "none", "--bind-addr", "0.0.0.0:8080", "/home/coder/project"],
      ExposedPorts: { [CONTAINER_PORT]: {} },
      HostConfig: hostConfig,
    });
    await container.start();
  }

  async function requireProjectAccess(
    request: FastifyRequest,
    projectId: string,
  ): Promise<IdentityUser | null> {
    const user = await options.identity.userFrom(request);
    if (user === null) {
      return null;
    }
    if (!userCanAccessProject(projectId, user.id)) {
      return null;
    }
    return user;
  }

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/ide/start",
    async (request, reply) => {
      if (domain === null) {
        return reply.code(503).send({ error: "code-server is not configured" });
      }
      const user = await requireProjectAccess(request, request.params.projectId);
      if (user === null) {
        return reply.code(404).send({ error: "not found" });
      }
      try {
        await ensureContainer(request.params.projectId);
      } catch (err) {
        return reply.code(502).send({
          error: `failed to start code-server: ${err instanceof Error ? err.message : String(err)}`,
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
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!ready) {
        return reply.code(504).send({ error: "code-server did not become ready in time" });
      }
      sweep();
      const ticket = randomBytes(24).toString("base64url");
      tickets.set(ticket, { projectId: request.params.projectId, expiresAt: Date.now() + TICKET_TTL_MS });
      const scheme = secure ? "https" : "http";
      return {
        url: `${scheme}://${request.params.projectId}.${domain}/?fc_ide=${ticket}`,
      };
    },
  );

  app.post<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/ide/stop",
    async (request, reply) => {
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
    },
  );

  if (domain === null) {
    return;
  }

  // Host-routed IDE traffic bypasses normal path-based routing entirely — this hook
  // runs for every request on this same port/process and short-circuits when the
  // Host header names a project's IDE subdomain.
  app.addHook("onRequest", async (request, reply) => {
    const projectId = projectIdFromHost(request.headers.host, domain);
    if (projectId === null) {
      return;
    }
    sweep();
    const cookies = parseCookies(request.headers.cookie);
    const query = request.query as { fc_ide?: unknown };
    let sessionId = cookies.get("fc_ide");

    if (typeof query.fc_ide === "string") {
      const ticket = tickets.get(query.fc_ide);
      if (ticket === undefined || ticket.projectId !== projectId) {
        return reply.code(403).send("invalid or expired IDE link");
      }
      tickets.delete(query.fc_ide);
      sessionId = randomBytes(24).toString("base64url");
      sessions.set(sessionId, { projectId, expiresAt: Date.now() + COOKIE_TTL_SECONDS * 1000 });
      const cookieParts = [
        `fc_ide=${sessionId}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${COOKIE_TTL_SECONDS}`,
      ];
      if (secure) cookieParts.push("Secure");
      reply.header("Set-Cookie", cookieParts.join("; "));
      // redirect to the clean URL so the ticket never lingers in browser history
      return reply.redirect(new URL(request.url, `http://${request.headers.host}`).pathname);
    }

    const session = sessionId !== undefined ? sessions.get(sessionId) : undefined;
    if (session === undefined || session.projectId !== projectId) {
      return reply.code(401).send("not connected — open the IDE from the project page");
    }

    const target = await resolveTarget(projectId);
    if (target === null) {
      return reply.code(409).send("IDE is not running — start it from the project page");
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
      sweep();
      const cookies = parseCookies(req.headers.cookie);
      const sessionId = cookies.get("fc_ide");
      const session = sessionId !== undefined ? sessions.get(sessionId) : undefined;
      if (session === undefined || session.projectId !== projectId) {
        socket.destroy();
        return;
      }
      const target = await resolveTarget(projectId);
      if (target === null) {
        socket.destroy();
        return;
      }
      proxy.ws(req, socket, head, { target });
    })();
  });
}
