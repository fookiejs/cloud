import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScriptApi } from './api-client.js';
import { registerTools } from './tools.js';

export function createScriptMcpServer(api: ScriptApi): McpServer {
  const server = new McpServer({
    name: 'script',
    version: '0.1.0',
  });
  registerTools(server, api);
  return server;
}
