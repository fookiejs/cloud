# @umudik/fookie-cloud-mcp

Unified Fookie Cloud MCP for Notes, Task Bridge, and Script.

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
        "TASK_BRIDGE_URL": "https://task.fookiecloud.com",
        "SCRIPT_API_URL": "https://script.fookiecloud.com"
      }
    }
  }
}
```

Destructive Script tools (delete workspace/task, env write) are intentionally omitted.
