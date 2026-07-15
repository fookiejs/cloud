import type { FastifyInstance } from "fastify";
import { openapiSpec } from "../openapi.js";

/**
 * GET /api/docs — returns the OpenAPI 3.1 spec as raw JSON.
 * No auth required. No Swagger UI — just the machine-readable spec.
 */
export function docsRoutes(app: FastifyInstance) {
  app.get("/docs", async (_request, reply) => {
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Cache-Control", "no-cache")
      .send(JSON.stringify(openapiSpec, null, 2));
  });
}
