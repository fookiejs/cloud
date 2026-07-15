# @umudik/task-bridge-mcp

MCP server for [Task Bridge](https://task-bridge.fookiecloud.com) — claim tasks, read agent context, complete work from Cursor.

## Cursor config

Cloud with a Fookie API key (from [fookiecloud.com/profile](https://fookiecloud.com/profile)):

```json
{
  "mcpServers": {
    "task-bridge": {
      "command": "npx",
      "args": ["-y", "@umudik/task-bridge-mcp"],
      "env": {
        "TASK_BRIDGE_URL": "https://task-bridge.fookiecloud.com",
        "FOOKIE_API_KEY": "<paste-key>"
      }
    }
  }
}
```

Local dev (`npm run dev` in task-bridge repo):

```json
{
  "mcpServers": {
    "task-bridge": {
      "command": "npx",
      "args": ["-y", "@umudik/task-bridge-mcp"],
      "env": {
        "TASK_BRIDGE_URL": "http://localhost:3000",
        "TASK_BRIDGE_TOKEN": "<bearer-token>"
      }
    }
  }
}
```

Also accepted: `FOOKIE_API_KEY` with cloud URL.

## Orchestration loop (with Lotaru)

1. `claim_next_task` — take the next workflow task
2. `get_task_context` — description, brief, full comments, epic stage
3. Implement in Cursor; run shell on your machine via `@umudik/lotaru-mcp` (`task-create` + `task-run`, e.g. `gh pr create`)
4. `complete_task` — mark done, append summary + PR URL, unclaim, get next claimable task

Pair with Lotaru MCP in the same `.cursor/mcp.json` for local execution and PR creation.

## Key tools

| Tool | Purpose |
|------|---------|
| `claim_next_task` | Atomically claim next available task |
| `get_task_context` | Packed agent context (brief + comments + epic) |
| `update_task_brief` | Living summary / pinned decisions |
| `add_comment` | `role: system` for agent notes (keeps claim) |
| `complete_task` | Done + brief + PR + epic stage result |
| `list_worker_pending` | Queue preview |

## Dev

```powershell
npm --prefix apps/mcp install
npm --prefix apps/mcp run build
npm --prefix apps/mcp run dev
```

Server speaks MCP over stdio.
