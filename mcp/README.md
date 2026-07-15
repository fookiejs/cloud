# @umudik/fookie-cloud-mcp

Unified Fookie Cloud MCP for Notes, Task Bridge, and Lotaru.

## Auth

Requires `FOOKIE_API_KEY` (from https://fookiecloud.com/profile).

## Cursor

```json
{
  "mcpServers": {
    "fookie-cloud": {
      "command": "npx",
      "args": ["-y", "@umudik/fookie-cloud-mcp"],
      "env": {
        "FOOKIE_API_KEY": "<paste-key>",
        "NOTES_URL": "https://notes.fookiecloud.com",
        "TASK_BRIDGE_URL": "https://task-bridge.fookiecloud.com",
        "LOTARU_API_URL": "https://lotaru.fookiecloud.com"
      }
    }
  }
}
```

Destructive Lotaru tools (delete workspace/task, env write) are intentionally omitted.
