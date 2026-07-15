import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LotaruApi } from './api-client.js';
import { registerTools } from './tools.js';

export function createLotaruMcpServer(api: LotaruApi): McpServer {
  const server = new McpServer({
    name: 'lotaru',
    version: '0.1.0',
  });
  registerTools(server, api);
  return server;
}
