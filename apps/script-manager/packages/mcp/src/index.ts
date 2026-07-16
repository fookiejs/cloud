#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScriptApi } from './api-client.js';
import { createScriptMcpServer } from './server.js';

async function main(): Promise<void> {
  const api = ScriptApi.fromEnv();
  const server = createScriptMcpServer(api);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  let message = String(error);
  if (error instanceof Error) {
    message = error.message;
  }
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
