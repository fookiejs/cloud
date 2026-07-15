#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskBridgeApi } from "./api-client.js";
import { createTaskBridgeMcpServer } from "./server.js";

async function main() {
  const api = TaskBridgeApi.fromEnv();
  const server = createTaskBridgeMcpServer(api);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  let message = String(error);
  if (error instanceof Error) {
    message = error.message;
  }
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
