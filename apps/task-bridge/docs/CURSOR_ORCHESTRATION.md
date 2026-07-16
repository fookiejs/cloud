# Cursor orchestration: Task Bridge + Script

Use both MCP servers in `.cursor/mcp.json` so Cursor plans work in Task Bridge and runs commands on your machine via Script.

## Prerequisites

1. API key from [fookiecloud.com/profile](https://fookiecloud.com/profile)
2. Local Script agent: `npx -y @umudik/script@latest` (sign in when prompted)
3. `gh` CLI authenticated on the machine where Script runs (for PR creation)

## MCP config (cloud)

```json
{
  "mcpServers": {
    "task-bridge": {
      "command": "npx",
      "args": ["-y", "@umudik/task-bridge-mcp"],
      "env": {
        "TASK_BRIDGE_URL": "https://task.fookiecloud.com",
        "FOOKIE_API_KEY": "<paste-key>"
      }
    },
    "fookie-cloud": {
      "command": "npx",
      "args": ["-y", "@umudik/fookie-cloud-mcp"],
      "env": {
        "FOOKIE_API_KEY": "<paste-key>",
        "SCRIPT_API_URL": "https://script.fookiecloud.com",
        "TASK_BRIDGE_URL": "https://task.fookiecloud.com"
      }
    }
  }
}
```

Reload MCP in Cursor after saving.

## Loop per task

1. **Claim** — `claim_next_task` with your `projectId`
2. **Context** — `get_task_context` on the claimed `taskId` (description, brief, all comments, epic stage, `replyLanguage`, `agentInstructions`)
3. **Work** — implement in the repo; use `update_task_brief` and `add_comment` with `role: system` for decisions (keeps claim). Comments, completion, and Notes must match the epic Objective language (`replyLanguage` / `agentInstructions`).
4. **Run** — Script `task-create` (shell) + `task-run` for tests, builds, or `gh pr create ...`
5. **Complete** — `complete_task` with `summary` and `prUrl`; response includes epic stage and next claimable task

## Example Cursor instruction

```
Claim the next Task Bridge task for project <id>. Read full context. Implement the change.
Run tests via Script shell task. Open a PR with gh. Complete the Task Bridge task with the PR URL.
```

## Agent context

- **brief** — living summary; use `update_task_brief` to append decisions
- **comments** — full thread on every claim/context call
- **complete_task** — atomic done + unclaim + epic progression hint

System comments (`role: system`) do not release the claim; user comments do (human follow-up).
