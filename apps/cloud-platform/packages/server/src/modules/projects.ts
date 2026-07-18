import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createProject,
  listPublicProjects,
  refreshProjectRegistry,
  updateProject,
} from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity } from "./identity.js";

const projectIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  id: z.string().trim().refine((projectId) => projectId.length === 0 || projectIdPattern.test(projectId)),
  description: z.string().trim(),
  workflowTemplateId: z.string().trim().min(1),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim(),
  workflowTemplateId: z.string().trim().min(1),
});

const projectParamsSchema = z.object({
  projectId: z.string().trim().regex(projectIdPattern),
});

export async function registerProjectsModule(
  app: FastifyInstance,
  identity: Identity,
): Promise<void> {
  refreshProjectRegistry();

  app.get("/api/projects", async (request, reply) => {
    const user = await identity.userFrom(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    refreshProjectRegistry();
    return { projects: listPublicProjects(user.id) };
  });

  app.post("/api/projects", async (request, reply) => {
    const user = await identity.userFrom(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const input = createProjectSchema.parse(request.body);
    const created = createProject(input, user.id);
    if (created === "duplicate") {
      return reply.code(409).send({ error: "Project id already exists" });
    }
    if (created === null) {
      return reply.code(400).send({ error: "Invalid project" });
    }
    return reply.code(201).send(created);
  });

  app.patch("/api/projects/:projectId", async (request, reply) => {
    const user = await identity.userFrom(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { projectId } = projectParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);
    const updated = updateProject(projectId, input, user.id);
    if (updated === null) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return reply.send(updated);
  });
}
