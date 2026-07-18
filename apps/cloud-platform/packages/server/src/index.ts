import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import "@fastify/multipart";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { registerScriptGatewayModule } from "../../../../script-manager/packages/gateway/dist/main.js";
import { registerTaskBridgeModule } from "../../../../task-bridge/apps/backend/dist/index.js";
import { registerObservability } from "../../../../task-bridge/apps/backend/dist/observability.js";
import { registerEmbeddedAuth } from "./modules/embedded-auth.js";
import { createIdentity } from "./modules/identity.js";
import { registerNotesModule } from "./modules/notes.js";

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
const scriptClientId = process.env.SCRIPT_CLIENT_ID?.trim() || "script";
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
const configuredOrigins = String(process.env.ALLOWED_ORIGINS ?? publicUrl)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
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
await registerNotesModule(app, {
  dataFile: join(dataDirectory, "notes.json"),
  adminEmails,
  identity,
});
await registerTaskBridgeModule(app, {
  verifyAccessToken: identity.verifyAccessToken,
});
await registerScriptGatewayModule(app, {
  auth: {
    issuer: identity.issuer,
    clientId: scriptClientId,
    verifyAccessToken: identity.verifyAccessToken,
  },
  publicUrl,
  allowedOrigins: new Set(configuredOrigins),
  observability: false,
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
