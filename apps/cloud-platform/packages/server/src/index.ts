import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import "@fastify/multipart";
import { config as loadDotenv } from "dotenv";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// Docker Compose reads .env itself; this is only for `npm run dev`/`npm start`
// running the server directly, where nothing else loads it into process.env.
loadDotenv();
import { registerTaskBridgeModule } from "../../../../task-bridge/apps/backend/dist/index.js";
import { registerObservability } from "../../../../task-bridge/apps/backend/dist/observability.js";
import { registerCodeServerModule } from "./modules/code-server.js";
import { registerEmbeddedAuth } from "./modules/embedded-auth.js";
import { registerGitProjectsModule } from "./modules/git-projects.js";
import { registerGithubAuthModule } from "./modules/github-auth.js";
import { createIdentity } from "./modules/identity.js";
import { registerNotesModule } from "./modules/notes.js";
import { registerPenpotModule } from "./modules/penpot.js";
import { registerProjectsModule } from "./modules/projects.js";
import { registerScriptRunnerModule } from "./modules/script-runner.js";

function requiredProductionValue(name: string, developmentFallback: string): string {
  const value = process.env[name]?.trim();
  if (value !== undefined && value.length > 0) {
    return value;
  }
  if (process.env.NODE_ENV === "development") {
    return developmentFallback;
  }
  throw new Error(`${name} is required in production`);
}

function apiPath(url: string): boolean {
  return (
    url.startsWith("/api/") ||
    url.startsWith("/v1/") ||
    url === "/healthz" ||
    url === "/metrics"
  );
}

const port = Number(process.env.PORT ?? 8080);
const dataDirectory = process.env.DATA_DIR ?? join(process.cwd(), "data");
const publicUrl = requiredProductionValue("PUBLIC_URL", `http://127.0.0.1:${port}`);
const authIssuer = (process.env.FOOKIE_AUTH_ISSUER ?? "https://auth.fookiecloud.com").replace(/\/$/, "");
const adminEmails = new Set(
  String(process.env.FOOKIE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const localViewerEmail =
  process.env.NODE_ENV === "development" && process.env.FOOKIE_LOCAL_AUTH_EMAIL
    ? process.env.FOOKIE_LOCAL_AUTH_EMAIL.trim().toLowerCase()
    : null;
const app = Fastify({ logger: true, trustProxy: true });

await registerEmbeddedAuth(app, authIssuer);
await app.register(fastifyWebsocket);
registerObservability(app);
app.get("/healthz", async () => ({ status: "ok", service: "fookie-cloud" }));

const identity = await createIdentity({
  issuer: authIssuer,
  publicUrl,
  clientId: process.env.FOOKIE_AUTH_CLIENT_ID?.trim() || "fookie",
  localViewerEmail,
  localViewerName: process.env.FOOKIE_LOCAL_AUTH_NAME?.trim() || "FookieCloud User",
});

await identity.register(app);
await registerProjectsModule(app, identity);
await registerNotesModule(app, {
  dataFile: join(dataDirectory, "notes.json"),
  adminEmails,
  identity,
});
await registerTaskBridgeModule(app, {
  verifyAccessToken: identity.verifyAccessToken,
  registerProjectRoutes: false,
});
// Every per-project backing service (scripts, git checkout, code-server) shares this
// same data dir / host-dir pair so they all resolve to one project root folder.
const projectPaths = {
  dataDir: process.env.SCRIPT_DATA_DIR?.trim() || join(dataDirectory, "script"),
  workspacesHostDir: process.env.SCRIPT_WORKSPACES_HOST_DIR?.trim() || null,
};
await registerScriptRunnerModule(app, {
  identity,
  ...projectPaths,
  sandboxImage: process.env.SCRIPT_SANDBOX_IMAGE?.trim() || "node:22-bookworm",
});
const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
const github = await registerGithubAuthModule(app, {
  identity,
  dataDir: dataDirectory,
  publicUrl,
  clientId: githubClientId !== undefined && githubClientId.length > 0 ? githubClientId : null,
  clientSecret:
    githubClientSecret !== undefined && githubClientSecret.length > 0 ? githubClientSecret : null,
});
await registerGitProjectsModule(app, { ...projectPaths, identity, github });
const codeServerDomain = process.env.CODE_SERVER_DOMAIN?.trim();
await registerCodeServerModule(app, {
  ...projectPaths,
  identity,
  publicUrl,
  image: process.env.CODE_SERVER_IMAGE?.trim() || "codercom/code-server:latest",
  domain: codeServerDomain !== undefined && codeServerDomain.length > 0 ? codeServerDomain : null,
});
const penpotAccessToken = process.env.PENPOT_ACCESS_TOKEN?.trim();
await registerPenpotModule(app, {
  identity,
  dataFile: join(dataDirectory, "penpot-teams.json"),
  publicUri: (process.env.PENPOT_PUBLIC_URI?.trim() || "https://penpot.fookiecloud.com").replace(/\/$/, ""),
  accessToken:
    penpotAccessToken !== undefined && penpotAccessToken.length > 0 ? penpotAccessToken : null,
});

const webRoot = resolve(process.env.WEB_DIST_DIR ?? join(process.cwd(), "packages", "web", "dist"));
if (!existsSync(join(webRoot, "index.html"))) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`web bundle missing at ${webRoot}`);
  }
  app.log.warn({ webRoot }, "web bundle missing; SPA hosting disabled");
} else {
  await app.register(fastifyStatic, {
    root: webRoot,
    prefix: "/",
    wildcard: false,
  });
  app.setNotFoundHandler((request, reply) => {
    if (apiPath(request.url)) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.sendFile("index.html");
  });
}

await app.listen({ host: "0.0.0.0", port });
