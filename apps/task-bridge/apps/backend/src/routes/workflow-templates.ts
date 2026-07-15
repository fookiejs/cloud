import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { assertAuth } from "../middleware/auth.js";
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplate,
  importWorkflowTemplate,
  listAccessibleWorkflowTemplates,
  replaceWorkflowTemplate,
  userCanMutateWorkflowTemplate,
  userCanReadWorkflowTemplate,
} from "../services/workflow-template-service.js";

const templateIdParamsSchema = z.object({
  templateId: z.string().trim().min(1),
});

const taskTemplateSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().optional().default(""),
    assigneeRole: z.string().trim().optional().default(""),
    dependsOn: z.array(z.string().trim()).optional().default([]),
    children: z.array(taskTemplateSchema).optional().default([]),
  }),
);

const stageSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  position: z.number().int().nonnegative(),
  autoAssignRole: z.string().trim().optional().default(""),
  layoutX: z.number().nullable().optional(),
  layoutY: z.number().nullable().optional(),
  spawnTaskCount: z.number().int().nonnegative().optional().default(0),
  taskTemplates: z.array(taskTemplateSchema).optional().default([]),
});

const replaceTemplateSchema = z.object({
  stages: z.array(stageSchema).min(1),
});

const createTemplateSchema = z.object({
  id: z.string().trim().default(""),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
});

const importSchema = z.object({
  id: z.string().trim().default(""),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
  stages: z.array(stageSchema).min(1),
}).passthrough();

export function workflowTemplateRoutes(app: FastifyInstance) {
  app.get("/workflow-templates", async (request) => {
    const user = await assertAuth(request);
    return { items: listAccessibleWorkflowTemplates(user.id) };
  });

  app.post("/workflow-templates/import", async (request, reply) => {
    const user = await assertAuth(request);
    let importBody = request.body;
    if (importBody === null) { importBody = {}; }
    const body = importSchema.parse(importBody);
    const template = importWorkflowTemplate({
      id: body.id,
      title: body.title,
      description: body.description,
      ownerUserId: user.id,
      stages: body.stages.map((stage) => {
        let layoutX: number | null = null;
        if (Number(stage.layoutX) === stage.layoutX) {
          layoutX = stage.layoutX;
        }
        let layoutY: number | null = null;
        if (Number(stage.layoutY) === stage.layoutY) {
          layoutY = stage.layoutY;
        }
        let autoAssignRole: string | null = null;
        if (stage.autoAssignRole) {
          autoAssignRole = stage.autoAssignRole;
        }
        return Object.assign({}, stage, { layoutX, layoutY, autoAssignRole, activeTaskCount: null });
      }),
    });
    return reply.status(201).send(template);
  });

  app.post("/workflow-templates", async (request, reply) => {
    const user = await assertAuth(request);
    let createTemplateBody = request.body;
    if (createTemplateBody === null) { createTemplateBody = {}; }
    const body = createTemplateSchema.parse(createTemplateBody);
    const template = createWorkflowTemplate({
      id: body.id,
      title: body.title,
      description: body.description,
      ownerUserId: user.id,
    });
    return reply.status(201).send(template);
  });

  app.get("/workflow-templates/:templateId", async (request, reply) => {
    const user = await assertAuth(request);
    const { templateId } = templateIdParamsSchema.parse(request.params);
    if (!userCanReadWorkflowTemplate(templateId, user.id)) {
      return reply.status(404).send({ error: "Workflow template not found" });
    }
    const template = getWorkflowTemplate(templateId);
    if (!template) {
      return reply.status(404).send({ error: "Workflow template not found" });
    }
    return template;
  });

  app.get("/workflow-templates/:templateId/export", async (request, reply) => {
    const user = await assertAuth(request);
    const { templateId } = templateIdParamsSchema.parse(request.params);
    if (!userCanReadWorkflowTemplate(templateId, user.id)) {
      throw new AppError("Workflow template not found", 404);
    }
    const template = getWorkflowTemplate(templateId);
    if (!template) {
      throw new AppError("Workflow template not found", 404);
    }
    const payload = {
      exportedFrom: "task-bridge",
      version: 1,
      id: template.id,
      title: template.title,
      description: template.description,
      stages: template.stages,
    };
    const filename = `${template.id}.json`;
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(JSON.stringify(payload, null, 2));
  });

  app.put("/workflow-templates/:templateId", async (request, reply) => {
    const user = await assertAuth(request);
    const { templateId } = templateIdParamsSchema.parse(request.params);
    if (!userCanMutateWorkflowTemplate(templateId, user.id)) {
      return reply.status(404).send({ error: "Workflow template not found" });
    }
    let replaceTemplateBody = request.body;
    if (replaceTemplateBody === null) { replaceTemplateBody = {}; }
    const body = replaceTemplateSchema.parse(replaceTemplateBody);
    const template = replaceWorkflowTemplate(
      templateId,
      body.stages.map((stage) => {
        let layoutX: number | null = null;
        if (Number(stage.layoutX) === stage.layoutX) {
          layoutX = stage.layoutX;
        }
        let layoutY: number | null = null;
        if (Number(stage.layoutY) === stage.layoutY) {
          layoutY = stage.layoutY;
        }
        let autoAssignRole: string | null = null;
        if (stage.autoAssignRole) {
          autoAssignRole = stage.autoAssignRole;
        }
        return Object.assign({}, stage, { layoutX, layoutY, autoAssignRole, activeTaskCount: null });
      }),
    );
    return reply.status(200).send(template);
  });

  app.delete("/workflow-templates/:templateId", async (request, reply) => {
    const user = await assertAuth(request);
    const { templateId } = templateIdParamsSchema.parse(request.params);
    if (!userCanMutateWorkflowTemplate(templateId, user.id)) {
      return reply.status(404).send({ error: "Workflow template not found" });
    }
    deleteWorkflowTemplate(templateId);
    return reply.status(204).send();
  });
}
