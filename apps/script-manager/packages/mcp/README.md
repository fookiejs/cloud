# @umudik/script-mcp

MCP server for [Script](https://script.fookiecloud.com) — list/create/run tasks from Cursor.

## Cursor config

Local agent (`npx -y @umudik/script` running):

```json
{
  "mcpServers": {
    "Script Manager": {
      "command": "npx",
      "args": ["-y", "@umudik/script-mcp"]
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
      "args": ["-y", "@umudik/script-mcp"],
      "env": {
        "SCRIPT_API_URL": "https://script.fookiecloud.com",
        "FOOKIE_API_KEY": "<paste-key>"
      }
    }
  }
}
```

Also accepted: `SCRIPT_TOKEN`, or `~/.script/credentials.json` when `SCRIPT_API_URL` points at cloud.

## Tools

- Workspaces: `workspace-list|create|update|delete|pause|resume`
- Tasks: `task-list|create|one|update|delete|run`
- Executions: `execution-list|running|log|cancel`
- Environments: `environment-list|create`
