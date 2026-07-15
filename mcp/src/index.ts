#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const FOOKIE_API_KEY = process.env.FOOKIE_API_KEY || "";
const NOTES_URL = (process.env.NOTES_URL || "https://notes.fookiecloud.com").replace(/\/$/, "");
const TASK_BRIDGE_URL = (process.env.TASK_BRIDGE_URL || "https://task-bridge.fookiecloud.com").replace(
  /\/$/,
  "",
);
const LOTARU_API_URL = (process.env.LOTARU_API_URL || "https://lotaru.fookiecloud.com").replace(
  /\/$/,
  "",
);
const ENABLE_LOTARU = String(process.env.FOOKIE_MCP_ENABLE_LOTARU || "1") !== "0";

if (!FOOKIE_API_KEY) {
  process.stderr.write("FOOKIE_API_KEY is required\n");
  process.exit(1);
}

async function api(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${FOOKIE_API_KEY}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  return data;
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "fookie-cloud",
  version: "0.1.0",
});

server.tool("notes_list", "List Notes inbox items", {}, async () => {
  return textResult(await api(NOTES_URL, "GET", "/api/notes"));
});

server.tool(
  "notes_get",
  "Get one note by id",
  { id: z.string().min(1) },
  async ({ id }) => textResult(await api(NOTES_URL, "GET", `/api/notes/${id}`)),
);

server.tool(
  "notes_create",
  "Create a note (title + body)",
  {
    title: z.string().min(1),
    body: z.string().min(1),
    source: z.string().optional(),
  },
  async ({ title, body, source }) =>
    textResult(
      await api(NOTES_URL, "POST", "/api/notes", {
        title,
        body,
        source: source || "mcp",
      }),
    ),
);

server.tool(
  "notes_set_seen",
  "Mark a note seen or unseen",
  { id: z.string().min(1), seen: z.boolean() },
  async ({ id, seen }) =>
    textResult(await api(NOTES_URL, "PATCH", `/api/notes/${id}`, { seen })),
);

server.tool("tb_get_me", "Task Bridge current user", {}, async () =>
  textResult(await api(TASK_BRIDGE_URL, "GET", "/api/auth/me")),
);

server.tool("tb_list_projects", "List Task Bridge projects", {}, async () =>
  textResult(await api(TASK_BRIDGE_URL, "GET", "/api/projects")),
);

server.tool(
  "tb_list_inbox",
  "List Task Bridge inbox",
  { projectId: z.string().optional() },
  async ({ projectId }) => {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return textResult(await api(TASK_BRIDGE_URL, "GET", `/api/inbox${q}`));
  },
);

server.tool(
  "tb_claim_next",
  "Claim next Task Bridge worker task",
  { projectId: z.string().min(1) },
  async ({ projectId }) =>
    textResult(await api(TASK_BRIDGE_URL, "POST", "/api/worker/claim-next", { projectId })),
);

server.tool(
  "tb_get_task",
  "Get Task Bridge task",
  { id: z.union([z.string(), z.number()]) },
  async ({ id }) => textResult(await api(TASK_BRIDGE_URL, "GET", `/api/tasks/${id}`)),
);

server.tool(
  "tb_get_task_context",
  "Get Task Bridge task agent context",
  { id: z.union([z.string(), z.number()]) },
  async ({ id }) => textResult(await api(TASK_BRIDGE_URL, "GET", `/api/tasks/${id}/context`)),
);

server.tool(
  "tb_update_brief",
  "Update Task Bridge task brief",
  { id: z.union([z.string(), z.number()]), brief: z.string() },
  async ({ id, brief }) =>
    textResult(await api(TASK_BRIDGE_URL, "PATCH", `/api/tasks/${id}/brief`, { brief })),
);

server.tool(
  "tb_complete_task",
  "Complete Task Bridge subtask",
  {
    id: z.union([z.string(), z.number()]),
    summary: z.string().optional(),
    prUrl: z.string().optional(),
  },
  async ({ id, summary, prUrl }) =>
    textResult(
      await api(TASK_BRIDGE_URL, "POST", `/api/tasks/${id}/complete`, {
        ...(summary ? { summary } : {}),
        ...(prUrl ? { prUrl } : {}),
      }),
    ),
);

server.tool(
  "tb_create_epic",
  "Create Task Bridge epic",
  {
    projectId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
  },
  async ({ projectId, title, description }) =>
    textResult(
      await api(TASK_BRIDGE_URL, "POST", "/api/epics", {
        projectId,
        title,
        ...(description ? { description } : {}),
      }),
    ),
);

server.tool(
  "tb_add_comment",
  "Add Task Bridge system comment",
  {
    id: z.union([z.string(), z.number()]),
    text: z.string().min(1),
    tags: z.array(z.string()).optional(),
  },
  async ({ id, text, tags }) =>
    textResult(
      await api(TASK_BRIDGE_URL, "PATCH", `/api/tasks/${id}`, {
        comment: { text, role: "system", tags: tags || [], by: "fookie-cloud-mcp" },
      }),
    ),
);

if (ENABLE_LOTARU) {
  server.tool("lotaru_workspace_list", "List Lotaru workspaces", {}, async () =>
    textResult(await api(LOTARU_API_URL, "GET", "/api/v1/workspaces")),
  );

  server.tool(
    "lotaru_task_list",
    "List Lotaru tasks in a workspace",
    { workspaceId: z.string().min(1) },
    async ({ workspaceId }) =>
      textResult(await api(LOTARU_API_URL, "GET", `/api/v1/workspaces/${workspaceId}/tasks`)),
  );

  server.tool(
    "lotaru_task_one",
    "Get Lotaru task",
    { id: z.string().min(1) },
    async ({ id }) => textResult(await api(LOTARU_API_URL, "GET", `/api/v1/tasks/${id}`)),
  );

  server.tool(
    "lotaru_task_run",
    "Manually run a Lotaru task",
    { id: z.string().min(1) },
    async ({ id }) => textResult(await api(LOTARU_API_URL, "POST", `/api/v1/tasks/${id}/run`)),
  );

  server.tool(
    "lotaru_execution_list",
    "List recent Lotaru executions",
    { taskId: z.string().optional(), limit: z.number().optional() },
    async ({ taskId, limit }) => {
      const q = new URLSearchParams();
      if (taskId) q.set("taskId", taskId);
      if (limit) q.set("limit", String(limit));
      const suffix = q.toString() ? `?${q.toString()}` : "";
      return textResult(await api(LOTARU_API_URL, "GET", `/api/v1/executions${suffix}`));
    },
  );

  server.tool(
    "lotaru_execution_log",
    "Read Lotaru execution log",
    { id: z.string().min(1) },
    async ({ id }) => textResult(await api(LOTARU_API_URL, "GET", `/api/v1/executions/${id}/log`)),
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
