#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LotaruApi } from './api-client.js';
import { createLotaruMcpServer } from './server.js';

async function main(): Promise<void> {
  const api = LotaruApi.fromEnv();
  const server = createLotaruMcpServer(api);
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
