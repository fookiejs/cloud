import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import {
  createApiKey,
  listApiKeyRows,
  revokeApiKey,
  rowToSummary,
} from "../db/api-keys-db.js";
import { assertAuth } from "../middleware/auth.js";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).optional().default("API key"),
});

const keyIdParamsSchema = z.object({
  keyId: z.string().trim().min(1),
});

export function apiKeyRoutes(app: FastifyInstance) {
  app.get("/me/api-keys", async (request) => {
    const user = await assertAuth(request);
    return { items: listApiKeyRows(user.id).map(rowToSummary) };
  });

  app.post("/me/api-keys", async (request, reply) => {
    const user = await assertAuth(request);
    const body = createSchema.parse(request.body ?? {});
    const created = createApiKey(user.id, body.name);
    return reply.status(201).send({
      key: created.key,
      rawKey: created.rawKey,
    });
  });

  app.delete("/me/api-keys/:keyId", async (request, reply) => {
    const user = await assertAuth(request);
    const params = keyIdParamsSchema.parse(request.params);
    const ok = revokeApiKey(user.id, params.keyId);
    if (!ok) throw new AppError("API key not found", 404);
    return reply.status(204).send();
  });
}
