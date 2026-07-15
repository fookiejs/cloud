import { nanoid } from 'nanoid';
import { readFileSync, existsSync, statSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { Store } from '../db/index.js';
import type { Orchestrator } from '../orchestrator.js';
import type { EventBus } from '../events/bus.js';
import { INVALID_DOCKER_PLATFORM, parseDockerPlatformInput } from '../executor/platform.js';
import { pickFolder } from '../system/pickFolder.js';
import {
  buildProjectExportBundle,
  parseProjectImportBundle,
  resolveImportProjectMeta,
} from '../project-export.js';
import type {
  Task,
  Workspace,
  Environment,
  RuntimeKind,
  TriggerKind,
  ConcurrencyKind,
} from '../types.js';

interface CreateWorkspaceBody {
  name: string;
  path: string;
}

interface UpdateWorkspaceBody {
  name?: string;
  path?: string;
}

function validateWorkspacePath(path: string): string | null {
  if (path.length === 0) {
    return 'path required';
  }
  if (!existsSync(path)) {
    return 'path does not exist';
  }
  const st = statSync(path);
  if (!st.isDirectory()) {
    return 'path is not a directory';
  }
  return null;
}

interface CreateTaskBody {
  name: string;
  command: string;
  runtime: RuntimeKind;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: TriggerKind;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: ConcurrencyKind;
  enabled: boolean;
}

function isRuntime(v: unknown): v is RuntimeKind {
  return v === 'shell' || v === 'docker';
}
function isTrigger(v: unknown): v is TriggerKind {
  return v === 'save' || v === 'manual' || v === 'startup' || v === 'scheduled';
}
function isConcurrency(v: unknown): v is ConcurrencyKind {
  return v === 'restart' || v === 'queue' || v === 'ignore' || v === 'parallel';
}

function parseEnvVarsBody(raw: unknown): Record<string, string> | string {
  if (raw === undefined) {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) {
    return 'vars must be object';
  }
  const out: Record<string, string> = {};
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.length === 0) {
      return 'env key cannot be empty';
    }
    const val = obj[key];
    if (typeof val !== 'string') {
      return `env value for ${key} must be string`;
    }
    out[key] = val;
  }
  return out;
}

function validateCreateTask(body: unknown): CreateTaskBody | string {
  if (typeof body !== 'object' || body === null) {
    return 'body must be object';
  }
  const b = body as Record<string, unknown>;
  if (typeof b['name'] !== 'string' || b['name'].length === 0) {
    return 'name required';
  }
  if (typeof b['command'] !== 'string' || b['command'].length === 0) {
    return 'command required';
  }
  if (!isRuntime(b['runtime'])) {
    return 'invalid runtime';
  }
  if (!isTrigger(b['trigger_type'])) {
    return 'invalid trigger_type';
  }
  if (!isConcurrency(b['concurrency'])) {
    return 'invalid concurrency';
  }
  let dockerImage: string | null = null;
  if (b['docker_image'] !== undefined && b['docker_image'] !== null) {
    if (typeof b['docker_image'] !== 'string') {
      return 'docker_image must be string or null';
    }
    dockerImage = b['docker_image'];
  }
  let triggerGlob: string | null = null;
  if (b['trigger_glob'] !== undefined && b['trigger_glob'] !== null) {
    if (typeof b['trigger_glob'] !== 'string') {
      return 'trigger_glob must be string or null';
    }
    triggerGlob = b['trigger_glob'];
  }
  let triggerCron: string | null = null;
  if (b['trigger_cron'] !== undefined && b['trigger_cron'] !== null) {
    if (typeof b['trigger_cron'] !== 'string') {
      return 'trigger_cron must be string or null';
    }
    triggerCron = b['trigger_cron'];
  }
  let enabled = true;
  if (b['enabled'] !== undefined) {
    if (typeof b['enabled'] !== 'boolean') {
      return 'enabled must be boolean';
    }
    enabled = b['enabled'];
  }
  const platformParsed = parseDockerPlatformInput(b['docker_platform']);
  if (platformParsed === INVALID_DOCKER_PLATFORM) {
    return INVALID_DOCKER_PLATFORM;
  }
  let dockerPlatform: string | null = null;
  if (typeof platformParsed === 'string') {
    dockerPlatform = platformParsed;
  }
  return {
    name: b['name'],
    command: b['command'],
    runtime: b['runtime'],
    docker_image: dockerImage,
    docker_platform: dockerPlatform,
    trigger_type: b['trigger_type'],
    trigger_glob: triggerGlob,
    trigger_cron: triggerCron,
    concurrency: b['concurrency'],
    enabled,
  };
}

export function registerRoutes(
  app: FastifyInstance,
  store: Store,
  bus: EventBus,
  orch: Orchestrator,
): void {
  app.post('/api/v1/system/pick-folder', async (_req, reply) => {
    const result = await pickFolder();
    if ('error' in result) {
      await reply.code(501).send({ error: 'folder picker not available on this system' });
      return;
    }
    await reply.send({ path: result.path });
  });

  app.get('/api/v1/workspaces', async () => {
    return { workspaces: store.listWorkspaces() };
  });

  app.post<{ Body: unknown }>('/api/v1/workspaces', async (req, reply) => {
    const raw = req.body;
    if (typeof raw !== 'object' || raw === null) {
      await reply.code(400).send({ error: 'body required' });
      return;
    }
    const body = raw as Partial<CreateWorkspaceBody>;
    if (typeof body.name !== 'string' || body.name.length === 0) {
      await reply.code(400).send({ error: 'name required' });
      return;
    }
    if (typeof body.path !== 'string') {
      await reply.code(400).send({ error: 'path required' });
      return;
    }
    const pathErr = validateWorkspacePath(body.path);
    if (pathErr !== null) {
      await reply.code(400).send({ error: pathErr });
      return;
    }
    const w: Workspace = {
      id: nanoid(12),
      name: body.name,
      path: body.path,
      paused: false,
      active_environment_id: null,
      created_at: Date.now(),
    };
    store.insertWorkspace(w);
    orch.onWorkspaceCreated(w);
    bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
    await reply.send({ workspace: w });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/workspaces/:id',
    async (req, reply) => {
      const w = store.getWorkspace(req.params.id);
      if (w === null) {
        await reply.code(404).send({ error: 'not found' });
        return;
      }
      const raw = req.body;
      if (typeof raw !== 'object' || raw === null) {
        await reply.code(400).send({ error: 'body required' });
        return;
      }
      const body = raw as Partial<UpdateWorkspaceBody>;
      let nextName = w.name;
      let nextPath = w.path;
      if (typeof body.name === 'string') {
        if (body.name.length === 0) {
          await reply.code(400).send({ error: 'name required' });
          return;
        }
        nextName = body.name;
      }
      if (typeof body.path === 'string') {
        const pathErr = validateWorkspacePath(body.path);
        if (pathErr !== null) {
          await reply.code(400).send({ error: pathErr });
          return;
        }
        nextPath = body.path;
      }
      if (nextName === w.name && nextPath === w.path) {
        await reply.send({ workspace: w });
        return;
      }
      store.updateWorkspace(w.id, nextName, nextPath);
      const updated: Workspace = { ...w, name: nextName, path: nextPath };
      orch.onWorkspaceUpdated(updated);
      bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
      await reply.send({ workspace: updated });
    },
  );

  app.post<{ Params: { id: string } }>('/api/v1/workspaces/:id/pause', async (req, reply) => {
    const w = store.getWorkspace(req.params.id);
    if (w === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    store.setWorkspacePaused(w.id, true);
    const updated: Workspace = { ...w, paused: true };
    orch.onWorkspacePausedChanged(updated);
    bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
    await reply.send({ workspace: updated });
  });

  app.post<{ Params: { id: string } }>('/api/v1/workspaces/:id/resume', async (req, reply) => {
    const w = store.getWorkspace(req.params.id);
    if (w === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    store.setWorkspacePaused(w.id, false);
    const updated: Workspace = { ...w, paused: false };
    orch.onWorkspacePausedChanged(updated);
    bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
    await reply.send({ workspace: updated });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/workspaces/:id', async (req, reply) => {
    const w = store.getWorkspace(req.params.id);
    if (w === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    const tasks = store.listTasks(w.id);
    for (const t of tasks) {
      orch.onTaskDeleted(t.id);
    }
    store.deleteWorkspace(w.id);
    orch.onWorkspaceDeleted(w.id);
    bus.emit({ kind: 'workspace.deleted', workspaceId: w.id });
    await reply.send({ ok: true });
  });

  app.get<{ Params: { id: string } }>('/api/v1/workspaces/:id/export', async (req, reply) => {
    const bundle = buildProjectExportBundle(store, req.params.id);
    if (bundle === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    await reply.send(bundle);
  });

  app.post<{ Body: unknown }>('/api/v1/workspaces/import', async (req, reply) => {
    const raw = req.body;
    if (typeof raw !== 'object' || raw === null) {
      await reply.code(400).send({ error: 'body required' });
      return;
    }
    const body = raw as Record<string, unknown>;
    if (body['bundle'] === undefined) {
      await reply.code(400).send({ error: 'bundle required' });
      return;
    }
    if (typeof body['path'] !== 'string' || body['path'].length === 0) {
      await reply.code(400).send({ error: 'path required' });
      return;
    }
    const pathErr = validateWorkspacePath(body['path']);
    if (pathErr !== null) {
      await reply.code(400).send({ error: pathErr });
      return;
    }
    let nameOverride: string | undefined;
    if (body['name'] !== undefined) {
      if (typeof body['name'] !== 'string' || body['name'].length === 0) {
        await reply.code(400).send({ error: 'name must be non-empty string' });
        return;
      }
      nameOverride = body['name'];
    }
    const parsed = parseProjectImportBundle(body['bundle'], validateCreateTask);
    if (typeof parsed === 'string') {
      await reply.code(400).send({ error: parsed });
      return;
    }
    const meta = resolveImportProjectMeta(parsed, nameOverride, body['path']);
    const w: Workspace = {
      id: nanoid(12),
      name: meta.name,
      path: meta.path,
      paused: meta.paused,
      active_environment_id: null,
      created_at: Date.now(),
    };
    store.insertWorkspace(w);
    orch.onWorkspaceCreated(w);
    const envIds = new Map<string, string>();
    for (const envRow of parsed.environments) {
      const env: Environment = {
        id: nanoid(12),
        workspace_id: w.id,
        name: envRow.name,
        vars: envRow.vars,
        created_at: Date.now(),
      };
      try {
        store.insertEnvironment(env);
        envIds.set(envRow.name, env.id);
      } catch (_e: unknown) {
        continue;
      }
    }
    if (meta.active_environment_name !== null) {
      const activeId = envIds.get(meta.active_environment_name);
      if (activeId !== undefined) {
        store.setActiveEnvironment(w.id, activeId);
      }
    }
    let taskCount = 0;
    for (const v of parsed.tasks) {
      const t: Task = {
        id: nanoid(12),
        workspace_id: w.id,
        name: v.name,
        command: v.command,
        runtime: v.runtime,
        docker_image: v.docker_image,
        docker_platform: v.docker_platform,
        trigger_type: v.trigger_type,
        trigger_glob: v.trigger_glob,
        trigger_cron: v.trigger_cron,
        concurrency: v.concurrency,
        enabled: v.enabled,
        created_at: Date.now(),
      };
      store.insertTask(t);
      orch.onTaskCreated(t);
      bus.emit({ kind: 'task.updated', taskId: t.id });
      taskCount += 1;
    }
    const created = store.getWorkspace(w.id);
    if (created === null) {
      await reply.code(500).send({ error: 'import failed' });
      return;
    }
    bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
    await reply.send({ workspace: created, taskCount });
  });

  app.get<{ Params: { id: string } }>('/api/v1/workspaces/:id/environments', async (req, reply) => {
    const w = store.getWorkspace(req.params.id);
    if (w === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    await reply.send({ environments: store.listEnvironments(w.id) });
  });

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/workspaces/:id/environments',
    async (req, reply) => {
      const w = store.getWorkspace(req.params.id);
      if (w === null) {
        await reply.code(404).send({ error: 'not found' });
        return;
      }
      const raw = req.body;
      if (typeof raw !== 'object' || raw === null) {
        await reply.code(400).send({ error: 'body required' });
        return;
      }
      const body = raw as Record<string, unknown>;
      if (typeof body['name'] !== 'string' || body['name'].length === 0) {
        await reply.code(400).send({ error: 'name required' });
        return;
      }
      const varsParsed = parseEnvVarsBody(body['vars']);
      if (typeof varsParsed === 'string') {
        await reply.code(400).send({ error: varsParsed });
        return;
      }
      const env: Environment = {
        id: nanoid(12),
        workspace_id: w.id,
        name: body['name'],
        vars: varsParsed,
        created_at: Date.now(),
      };
      try {
        store.insertEnvironment(env);
      } catch (_e: unknown) {
        await reply.code(409).send({ error: 'environment name already exists' });
        return;
      }
      await reply.send({ environment: env });
    },
  );

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/environments/:id',
    async (req, reply) => {
      const existing = store.getEnvironment(req.params.id);
      if (existing === null) {
        await reply.code(404).send({ error: 'not found' });
        return;
      }
      const raw = req.body;
      if (typeof raw !== 'object' || raw === null) {
        await reply.code(400).send({ error: 'body required' });
        return;
      }
      const body = raw as Record<string, unknown>;
      let nextName = existing.name;
      if (body['name'] !== undefined) {
        if (typeof body['name'] !== 'string' || body['name'].length === 0) {
          await reply.code(400).send({ error: 'name required' });
          return;
        }
        nextName = body['name'];
      }
      let nextVars = existing.vars;
      if (body['vars'] !== undefined) {
        const varsParsed = parseEnvVarsBody(body['vars']);
        if (typeof varsParsed === 'string') {
          await reply.code(400).send({ error: varsParsed });
          return;
        }
        nextVars = varsParsed;
      }
      try {
        store.updateEnvironment(existing.id, nextName, nextVars);
      } catch (_e: unknown) {
        await reply.code(409).send({ error: 'environment name already exists' });
        return;
      }
      const updated: Environment = {
        ...existing,
        name: nextName,
        vars: nextVars,
      };
      await reply.send({ environment: updated });
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/environments/:id', async (req, reply) => {
    const env = store.getEnvironment(req.params.id);
    if (env === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    const w = store.getWorkspace(env.workspace_id);
    if (w !== null && w.active_environment_id === env.id) {
      store.setActiveEnvironment(w.id, null);
      bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
    }
    store.deleteEnvironment(env.id);
    await reply.send({ ok: true });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/workspaces/:id/active-environment',
    async (req, reply) => {
      const w = store.getWorkspace(req.params.id);
      if (w === null) {
        await reply.code(404).send({ error: 'not found' });
        return;
      }
      const raw = req.body;
      if (typeof raw !== 'object' || raw === null) {
        await reply.code(400).send({ error: 'body required' });
        return;
      }
      const body = raw as Record<string, unknown>;
      let environmentId: string | null = null;
      if (body['environment_id'] !== undefined && body['environment_id'] !== null) {
        if (typeof body['environment_id'] !== 'string') {
          await reply.code(400).send({ error: 'environment_id must be string or null' });
          return;
        }
        const env = store.getEnvironment(body['environment_id']);
        if (env === null || env.workspace_id !== w.id) {
          await reply.code(404).send({ error: 'environment not found' });
          return;
        }
        environmentId = env.id;
      }
      store.setActiveEnvironment(w.id, environmentId);
      const updated: Workspace = { ...w, active_environment_id: environmentId };
      bus.emit({ kind: 'workspace.updated', workspaceId: w.id });
      await reply.send({ workspace: updated });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/v1/workspaces/:id/tasks',
    async (req, reply) => {
      const w = store.getWorkspace(req.params.id);
      if (w === null) {
        await reply.code(404).send({ error: 'not found' });
        return;
      }
      let limit = 24;
      if (req.query.limit !== undefined) {
        const n = Number(req.query.limit);
        if (!Number.isNaN(n) && n > 0 && n <= 100) {
          limit = Math.floor(n);
        }
      }
      let cursor: string | null = null;
      if (req.query.cursor !== undefined && req.query.cursor.length > 0) {
        cursor = req.query.cursor;
      }
      const page = store.listTasksPage(w.id, cursor, limit);
      await reply.send({ tasks: page.tasks, nextCursor: page.nextCursor });
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/v1/workspaces/:id/tasks',
    async (req, reply) => {
      const w = store.getWorkspace(req.params.id);
      if (w === null) {
        await reply.code(404).send({ error: 'workspace not found' });
        return;
      }
      const v = validateCreateTask(req.body);
      if (typeof v === 'string') {
        await reply.code(400).send({ error: v });
        return;
      }
      const t: Task = {
        id: nanoid(12),
        workspace_id: w.id,
        name: v.name,
        command: v.command,
        runtime: v.runtime,
        docker_image: v.docker_image,
        docker_platform: v.docker_platform,
        trigger_type: v.trigger_type,
        trigger_glob: v.trigger_glob,
        trigger_cron: v.trigger_cron,
        concurrency: v.concurrency,
        enabled: v.enabled,
        created_at: Date.now(),
      };
      store.insertTask(t);
      orch.onTaskCreated(t);
      bus.emit({ kind: 'task.updated', taskId: t.id });
      await reply.send({ task: t });
    },
  );

  app.get<{ Params: { id: string } }>('/api/v1/tasks/:id', async (req, reply) => {
    const t = store.getTask(req.params.id);
    if (t === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    await reply.send({ task: t });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/api/v1/tasks/:id', async (req, reply) => {
    const existing = store.getTask(req.params.id);
    if (existing === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    const v = validateCreateTask(req.body);
    if (typeof v === 'string') {
      await reply.code(400).send({ error: v });
      return;
    }
    const t: Task = {
      ...existing,
      name: v.name,
      command: v.command,
      runtime: v.runtime,
      docker_image: v.docker_image,
      docker_platform: v.docker_platform,
      trigger_type: v.trigger_type,
      trigger_glob: v.trigger_glob,
      trigger_cron: v.trigger_cron,
      concurrency: v.concurrency,
      enabled: v.enabled,
    };
    store.updateTask(t);
    orch.onTaskUpdated(t);
    bus.emit({ kind: 'task.updated', taskId: t.id });
    await reply.send({ task: t });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/tasks/:id', async (req, reply) => {
    const t = store.getTask(req.params.id);
    if (t === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    orch.onTaskDeleted(t.id);
    store.deleteTask(t.id);
    bus.emit({ kind: 'task.deleted', taskId: t.id });
    await reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/v1/tasks/:id/run', async (req, reply) => {
    const t = store.getTask(req.params.id);
    if (t === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    const started = orch.triggerManual(t.id);
    if (!started) {
      await reply.code(409).send({ error: 'task already running' });
      return;
    }
    await reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/v1/executions/:id/cancel', async (req, reply) => {
    const ok = orch.cancelExecution(req.params.id);
    if (!ok) {
      await reply.code(404).send({ error: 'execution not found' });
      return;
    }
    await reply.send({ ok: true });
  });

  app.get('/api/v1/executions/running', async (_req, reply) => {
    await reply.send({ running: orch.listRunningExecutions() });
  });

  app.get<{ Querystring: { taskId?: string; limit?: string } }>(
    '/api/v1/executions',
    async (req, reply) => {
      let limit = 50;
      if (typeof req.query.limit === 'string') {
        const n = Number.parseInt(req.query.limit, 10);
        if (Number.isFinite(n) && n > 0 && n <= 500) {
          limit = n;
        }
      }
      if (typeof req.query.taskId === 'string' && req.query.taskId.length > 0) {
        await reply.send({ executions: store.listExecutionsByTask(req.query.taskId, limit) });
        return;
      }
      await reply.send({ executions: store.listRecentExecutions(limit) });
    },
  );

  app.get<{ Params: { id: string } }>('/api/v1/executions/:id/log', async (req, reply) => {
    const e = store.getExecution(req.params.id);
    if (e === null) {
      await reply.code(404).send({ error: 'not found' });
      return;
    }
    if (!existsSync(e.log_path)) {
      await reply.send({ log: '' });
      return;
    }
    const log = readFileSync(e.log_path, 'utf8');
    await reply.send({ log });
  });
}
