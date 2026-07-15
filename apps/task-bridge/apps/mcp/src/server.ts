import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TaskBridgeApi } from "./api-client.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

export function createTaskBridgeMcpServer(api: TaskBridgeApi) {
  const server = new McpServer({
    name: "task-bridge",
    version: "1.0.0",
  });

  registerTools(server, api);
  registerResources(server, api);

  return server;
}
