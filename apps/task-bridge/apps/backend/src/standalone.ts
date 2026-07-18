import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config.js";
import type { AppErrorDetails } from "./errors/app-error.js";
import { isAppError, statusCodeFromError, type HandledError } from "./errors/app-error.js";
import { registerTaskBridgeModule } from "./index.js";
import { createLogger } from "./logger.js";
import { registerObservability } from "./observability.js";
import { healthRoutes } from "./routes/health.js";
import { webRoutes } from "./routes/web.js";

const logger = createLogger("server");

async function main(): Promise<void> {
  const app = Fastify({ logger: false, trustProxy: true });
  registerObservability(app);
  healthRoutes(app);
  await registerTaskBridgeModule(app);
  await webRoutes(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: error.message });
    }
    const handled = error as HandledError;
    const statusCode = statusCodeFromError(handled);
    const message = error instanceof Error ? error.message : "Internal error";
    const body: { error: string; details: AppErrorDetails } = { error: message, details: null };
    if (isAppError(handled) && handled.details !== null) {
      body.details = handled.details;
    }
    return reply.status(statusCode).send(body);
  });
  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`Server listening on port ${config.port}`);
  logger.info(`Web UI: http://localhost:${config.port}/app/login`);
  logger.info("Projects loaded from database");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Failed to start", { error: message });
  process.exit(1);
});
