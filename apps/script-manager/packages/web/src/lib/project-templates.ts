import { api } from '@/api/client';
import { buildTaskPatchBody } from '@/lib/task-patch';
import type { UpdateTaskBody } from '@/lib/task-patch';
import type { Task } from '@/types';

export type TaskCreateBody = UpdateTaskBody;

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  tasks: readonly TaskCreateBody[];
}

export const EMPTY_PROJECT_TEMPLATE_ID = 'empty';

const TS_GLOB = '**/*.{ts,tsx,js,jsx,json}';

const NODEJS_TASKS: readonly TaskCreateBody[] = [
  {
    name: 'build',
    command: 'npm run build',
    runtime: 'shell',
    docker_image: null,
    docker_platform: null,
    trigger_type: 'save',
    trigger_glob: TS_GLOB,
    trigger_cron: null,
    concurrency: 'restart',
    enabled: true,
  },
  {
    name: 'lint',
    command: 'npm run lint',
    runtime: 'shell',
    docker_image: null,
    docker_platform: null,
    trigger_type: 'save',
    trigger_glob: TS_GLOB,
    trigger_cron: null,
    concurrency: 'queue',
    enabled: true,
  },
  {
    name: 'typecheck',
    command: 'npm run typecheck',
    runtime: 'shell',
    docker_image: null,
    docker_platform: null,
    trigger_type: 'save',
    trigger_glob: '**/*.{ts,tsx}',
    trigger_cron: null,
    concurrency: 'queue',
    enabled: true,
  },
  {
    name: 'test',
    command: 'npm test',
    runtime: 'shell',
    docker_image: null,
    docker_platform: null,
    trigger_type: 'manual',
    trigger_glob: null,
    trigger_cron: null,
    concurrency: 'ignore',
    enabled: true,
  },
  {
    name: 'dev',
    command: 'npm run dev',
    runtime: 'shell',
    docker_image: null,
    docker_platform: null,
    trigger_type: 'startup',
    trigger_glob: null,
    trigger_cron: null,
    concurrency: 'restart',
    enabled: true,
  },
];

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: EMPTY_PROJECT_TEMPLATE_ID,
    label: 'Empty',
    description: 'No tasks — add your own',
    tasks: [],
  },
  {
    id: 'nodejs',
    label: 'Node.js',
    description: 'build, lint, typecheck, test, dev',
    tasks: NODEJS_TASKS,
  },
];

export const BLANK_TASK_BODY: TaskCreateBody = {
  name: 'New task',
  command: 'echo hello',
  runtime: 'shell',
  docker_image: null,
  docker_platform: null,
  trigger_type: 'manual',
  trigger_glob: null,
  trigger_cron: null,
  concurrency: 'restart',
  enabled: true,
};

export function projectTemplateTasks(templateId: string): readonly TaskCreateBody[] {
  for (const row of PROJECT_TEMPLATES) {
    if (row.id === templateId) {
      return row.tasks;
    }
  }
  return [];
}

export function uniqueTaskName(base: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base} (${String(n)})`)) {
    n += 1;
  }
  return `${base} (${String(n)})`;
}

export function duplicateTaskBody(task: Task, existingNames: readonly string[]): TaskCreateBody {
  const name = uniqueTaskName(task.name, existingNames);
  return buildTaskPatchBody(task, { name });
}

export async function seedWorkspaceTasks(
  workspaceId: string,
  tasks: readonly TaskCreateBody[],
): Promise<void> {
  for (const body of tasks) {
    await api.createTask(workspaceId, body);
  }
}
