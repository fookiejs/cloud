import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { LotaruApi, LotaruApiError } from './api-client.js';
import { jsonToolResult, toolError } from './result.js';

async function runTool<T>(handler: () => Promise<T>) {
  try {
    const value = await handler();
    return jsonToolResult(value as object);
  } catch (error) {
    if (error instanceof LotaruApiError) {
      return toolError(`API ${String(error.status)}: ${error.message}`);
    }
    if (error instanceof Error) {
      return toolError(error.message);
    }
    return toolError(String(error));
  }
}

const runtimeSchema = z.enum(['shell', 'docker']);
const triggerSchema = z.enum(['save', 'manual', 'startup', 'scheduled']);
const concurrencySchema = z.enum(['restart', 'queue', 'ignore', 'parallel']);

function taskBody(input: {
  name: string;
  command: string;
  runtime?: 'shell' | 'docker' | undefined;
  docker_image?: string | null | undefined;
  docker_platform?: string | null | undefined;
  trigger_type?: 'save' | 'manual' | 'startup' | 'scheduled' | undefined;
  trigger_glob?: string | null | undefined;
  trigger_cron?: string | null | undefined;
  concurrency?: 'restart' | 'queue' | 'ignore' | 'parallel' | undefined;
  enabled?: boolean | undefined;
}) {
  return {
    name: input.name,
    command: input.command,
    runtime: input.runtime ?? 'shell',
    docker_image: input.docker_image ?? null,
    docker_platform: input.docker_platform ?? null,
    trigger_type: input.trigger_type ?? 'manual',
    trigger_glob: input.trigger_glob ?? null,
    trigger_cron: input.trigger_cron ?? null,
    concurrency: input.concurrency ?? 'restart',
    enabled: input.enabled ?? true,
  };
}

export function registerTools(server: McpServer, api: LotaruApi): void {
  server.tool('workspace-list', 'List Lotaru workspaces (projects).', {}, async () =>
    runTool(() => api.get('/api/v1/workspaces')),
  );

  server.tool(
    'workspace-create',
    'Create a workspace. Path must exist on the agent machine.',
    {
      name: z.string().min(1),
      path: z.string().min(1),
    },
    async (input) =>
      runTool(() => api.post('/api/v1/workspaces', { name: input.name, path: input.path })),
  );

  server.tool(
    'workspace-update',
    'Update a workspace name and/or path.',
    {
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      path: z.string().min(1).optional(),
    },
    async (input) => {
      const body: Record<string, string> = {};
      if (input.name !== undefined) body['name'] = input.name;
      if (input.path !== undefined) body['path'] = input.path;
      return runTool(() => api.patch(`/api/v1/workspaces/${input.id}`, body));
    },
  );

  server.tool(
    'workspace-delete',
    'Delete a workspace and its tasks.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.delete(`/api/v1/workspaces/${input.id}`)),
  );

  server.tool(
    'workspace-pause',
    'Pause a workspace (watchers/schedulers stop).',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.post(`/api/v1/workspaces/${input.id}/pause`)),
  );

  server.tool(
    'workspace-resume',
    'Resume a paused workspace.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.post(`/api/v1/workspaces/${input.id}/resume`)),
  );

  server.tool(
    'task-list',
    'List tasks in a workspace.',
    {
      workspaceId: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    async (input) =>
      runTool(() =>
        api.get(`/api/v1/workspaces/${input.workspaceId}/tasks`, {
          cursor: input.cursor ?? null,
          limit: input.limit ?? null,
        }),
      ),
  );

  server.tool(
    'task-create',
    'Create a task. Defaults: shell runtime, manual trigger, restart concurrency, enabled.',
    {
      workspaceId: z.string().min(1),
      name: z.string().min(1),
      command: z.string().min(1),
      runtime: runtimeSchema.optional(),
      docker_image: z.string().nullable().optional(),
      docker_platform: z.string().nullable().optional(),
      trigger_type: triggerSchema.optional(),
      trigger_glob: z.string().nullable().optional(),
      trigger_cron: z.string().nullable().optional(),
      concurrency: concurrencySchema.optional(),
      enabled: z.boolean().optional(),
    },
    async (input) =>
      runTool(() =>
        api.post(`/api/v1/workspaces/${input.workspaceId}/tasks`, taskBody(input)),
      ),
  );

  server.tool(
    'task-one',
    'Get a task by id.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.get(`/api/v1/tasks/${input.id}`)),
  );

  server.tool(
    'task-update',
    'Replace task fields (same shape as create).',
    {
      id: z.string().min(1),
      name: z.string().min(1),
      command: z.string().min(1),
      runtime: runtimeSchema.optional(),
      docker_image: z.string().nullable().optional(),
      docker_platform: z.string().nullable().optional(),
      trigger_type: triggerSchema.optional(),
      trigger_glob: z.string().nullable().optional(),
      trigger_cron: z.string().nullable().optional(),
      concurrency: concurrencySchema.optional(),
      enabled: z.boolean().optional(),
    },
    async (input) =>
      runTool(() => api.patch(`/api/v1/tasks/${input.id}`, taskBody(input))),
  );

  server.tool(
    'task-delete',
    'Delete a task.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.delete(`/api/v1/tasks/${input.id}`)),
  );

  server.tool(
    'task-run',
    'Trigger a manual run of a task.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.post(`/api/v1/tasks/${input.id}/run`)),
  );

  server.tool(
    'execution-list',
    'List recent executions, optionally filtered by task.',
    {
      taskId: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    async (input) =>
      runTool(() =>
        api.get('/api/v1/executions', {
          taskId: input.taskId ?? null,
          limit: input.limit ?? 50,
        }),
      ),
  );

  server.tool('execution-running', 'List currently running executions.', {}, async () =>
    runTool(() => api.get('/api/v1/executions/running')),
  );

  server.tool(
    'execution-log',
    'Fetch the log text for an execution.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.get(`/api/v1/executions/${input.id}/log`)),
  );

  server.tool(
    'execution-cancel',
    'Cancel a running execution.',
    { id: z.string().min(1) },
    async (input) => runTool(() => api.post(`/api/v1/executions/${input.id}/cancel`)),
  );

  server.tool(
    'environment-list',
    'List environments for a workspace.',
    { workspaceId: z.string().min(1) },
    async (input) =>
      runTool(() => api.get(`/api/v1/workspaces/${input.workspaceId}/environments`)),
  );

  server.tool(
    'environment-create',
    'Create an environment with optional key/value vars.',
    {
      workspaceId: z.string().min(1),
      name: z.string().min(1),
      vars: z.record(z.string()).optional(),
    },
    async (input) =>
      runTool(() =>
        api.post(`/api/v1/workspaces/${input.workspaceId}/environments`, {
          name: input.name,
          vars: input.vars ?? {},
        }),
      ),
  );
}
