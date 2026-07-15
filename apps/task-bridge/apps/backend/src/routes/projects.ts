import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "../domain/workflow-template-id.js";
import { isAppError, type HandledError } from "../errors/app-error.js";
import { assertAuth } from "../middleware/auth.js";
import {
  createProject,
  listPublicProjects,
  refreshProjectRegistry,
  updateProject,
} from "../services/project-registry.js";

const projectIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  id: z
    .string()
    .trim()
    .default("")
    .refine((value) => value === "" || projectIdPattern.test(value)),
  description: z.string().trim().default(""),
  workflowTemplateId: z.string().trim().default(DEFAULT_WORKFLOW_TEMPLATE_ID),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  workflowTemplateId: z.string().trim(),
});

const projectIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export function projectRoutes(app: FastifyInstance) {
  app.get("/projects", async (request) => {
    const user = await assertAuth(request);
    refreshProjectRegistry();
    return { projects: listPublicProjects(user.id) };
  });

  app.post("/projects", async (request, reply) => {
    const user = await assertAuth(request);
    let postBody = request.body;
    if (postBody === null) {
      postBody = {};
    }
    const body = createProjectSchema.parse(postBody);
    const created = createProject(body, user.id);
    if (created === "duplicate") {
      return reply.status(409).send({ error: "Project id already exists" });
    }
    if (!created) {
      return reply.status(400).send({ error: "Invalid project" });
    }
    return reply.status(201).send(created);
  });

  app.patch("/projects/:id", async (request, reply) => {
    const user = await assertAuth(request);
    const { id } = projectIdParamsSchema.parse(request.params);
    let patchBody = request.body;
    if (patchBody === null) {
      patchBody = {};
    }
    const body = updateProjectSchema.parse(patchBody);
    try {
      const updated = updateProject(id, body, user.id);
      if (!updated) {
        return reply.status(404).send({ error: "Project not found" });
      }
      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        workflowTemplateId: updated.workflowTemplateId,
      };
    } catch (error) {
      const handled = error as HandledError;
      if (isAppError(handled)) {
        return reply.status(handled.statusCode).send({ error: handled.message });
      }
      throw error;
    }
  });
}
