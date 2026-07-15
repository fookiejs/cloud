import type { FastifyInstance } from "fastify";

export function healthRoutes(app: FastifyInstance): void {
  app.get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));
}
