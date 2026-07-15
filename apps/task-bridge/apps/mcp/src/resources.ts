import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskBridgeApi } from "./api-client.js";

export function registerResources(server: McpServer, api: TaskBridgeApi) {
  server.resource(
    "openapi",
    "task-bridge://openapi",
    {
      mimeType: "application/json",
      description: "Task Bridge OpenAPI 3.1 specification",
    },
    async (uri) => {
      const spec = await api.getPublic<object>("/api/docs");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(spec, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "health",
    "task-bridge://health",
    {
      mimeType: "application/json",
      description: "Task Bridge server health",
    },
    async (uri) => {
      const health = await api.getPublic<object>("/health");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    },
  );
}
