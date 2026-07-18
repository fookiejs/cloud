import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { workflowRoutes } from "./routes/workflow.js";
import { workflowTemplateRoutes } from "./routes/workflow-templates.js";
import { libraryRoutes } from "./routes/library.js";
import { adminUserRoutes } from "./routes/admin-users.js";
import { docsRoutes } from "./routes/docs.js";
import { marketplaceRoutes } from "./routes/marketplace.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { refreshProjectRegistry, initProjectRegistry } from "./services/project-registry.js";
import { ensureMarketplaceReady } from "./services/marketplace-service.js";
import { migrateApiKeysTables } from "./db/api-keys-db.js";
import {
  configureFookieAccessTokenVerifier,
  type FookieAuthUser,
} from "./auth/fookie.js";

export type TaskBridgeModuleOptions = {
  verifyAccessToken?: (raw: string) => Promise<FookieAuthUser>;
};

export async function registerTaskBridgeModule(
  app: FastifyInstance,
  options: TaskBridgeModuleOptions = {},
): Promise<void> {
  configureFookieAccessTokenVerifier(options.verifyAccessToken ?? null);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  });

  initProjectRegistry();
  refreshProjectRegistry();
  ensureMarketplaceReady();
  migrateApiKeysTables();

  await app.register(
    async (apiApp) => {
      docsRoutes(apiApp);
      apiKeyRoutes(apiApp);
      if (!config.fookieMode) {
        adminUserRoutes(apiApp);
      }
      projectRoutes(apiApp);
      taskRoutes(apiApp);
      workflowRoutes(apiApp);
      workflowTemplateRoutes(apiApp);
      await libraryRoutes(apiApp);
      marketplaceRoutes(apiApp);
    },
    { prefix: "/api" },
  );
}
