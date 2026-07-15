# @umudik/lotaru-mcp

MCP server for [Lotaru](https://lotaru.fookiecloud.com) — list/create/run tasks from Cursor.

## Cursor config

Local agent (`npx -y @umudik/lotaru` running):

```json
{
  "mcpServers": {
    "Script Manager": {
      "command": "npx",
      "args": ["-y", "@umudik/lotaru-mcp"]
    }
  }
}
```

Cloud console with a Fookie API key (from [fookiecloud.com](https://fookiecloud.com)):

```json
{
  "mcpServers": {
    "Script Manager": {
      "command": "npx",
      "args": ["-y", "@umudik/lotaru-mcp"],
      "env": {
        "LOTARU_API_URL": "https://lotaru.fookiecloud.com",
        "FOOKIE_API_KEY": "<paste-key>"
      }
    }
  }
}
```

Also accepted: `LOTARU_TOKEN`, or `~/.lotaru/credentials.json` when `LOTARU_API_URL` points at cloud.

## Tools

- Workspaces: `workspace-list|create|update|delete|pause|resume`
- Tasks: `task-list|create|one|update|delete|run`
- Executions: `execution-list|running|log|cancel`
- Environments: `environment-list|create`
