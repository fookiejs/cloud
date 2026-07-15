import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveWebRoot() {
  const candidates = [
    join(moduleDir, "..", "..", "public"),
    join(moduleDir, "..", "..", "web", "dist"),
    join(process.cwd(), "public"),
    join(process.cwd(), "apps", "web", "dist"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

function resolveMobileApkPath(root: string) {
  return join(root, "downloads", "task-bridge.apk");
}

export async function webRoutes(app: FastifyInstance) {
  const root = resolveWebRoot();
  if (!root) {
    return;
  }

  const mobileApkPath = resolveMobileApkPath(root);

  app.get("/mobile/release", async (_request, reply) => {
    if (!existsSync(mobileApkPath)) {
      return reply.send({ available: false });
    }
    const stats = statSync(mobileApkPath);
    return reply.send({
      available: true,
      downloadUrl: "/downloads/task-bridge.apk",
      sizeBytes: stats.size,
      fileName: "task-bridge.apk",
    });
  });

  app.get("/downloads/task-bridge.apk", async (_request, reply) => {
    if (!existsSync(mobileApkPath)) {
      return reply.status(404).send({ error: "Android APK not bundled in this image" });
    }
    return reply
      .type("application/vnd.android.package-archive")
      .header("Content-Disposition", 'attachment; filename="task-bridge.apk"')
      .sendFile("downloads/task-bridge.apk", root);
  });

  await app.register(fastifyStatic, {
    root,
    prefix: "/app/",
    wildcard: false,
  });

  const spa = (_request: FastifyRequest, reply: FastifyReply) =>
    reply.sendFile("index.html", root);

  app.get("/", async (_request, reply) => reply.redirect("/app/login"));
  app.get("/callback", async (request, reply) => {
    const qs = request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : "";
    return reply.redirect(`/app/callback${qs}`);
  });
  app.get("/app", async (_request, reply) => reply.redirect("/app/login"));
  app.get("/app/login", spa);
  app.get("/app/callback", spa);
  app.get("/app/projects", spa);
  app.get("/app/projects/:projectId/tasks", spa);
  app.get("/app/projects/:projectId/inbox", spa);
  app.get("/app/projects/:projectId/tasks/:taskId", spa);
  app.get("/app/projects/:projectId/mobile", spa);
  app.get("/app/projects/:projectId/workflow", spa);
  app.get("/app/workflow-templates", spa);
  app.get("/app/admin/users", spa);
  app.get("/app/*", async (request, reply) => {
    const questionIndex = request.url.indexOf("?");
    let path = request.url;
    if (questionIndex >= 0) {
      path = request.url.slice(0, questionIndex);
    }
    if (path.startsWith("/app/assets/")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html", root);
  });
}
