import { toast } from 'sonner';
import { api } from '@/api/client';
import { resolveCronExpression } from '@/lib/cron-presets';
import { actions } from '@/state/store';
import type { Task } from '@/types';

export type UpdateTaskBody = Omit<Task, 'id' | 'workspace_id' | 'created_at'>;

export function buildTaskPatchBody(task: Task, partial: Partial<Task>): UpdateTaskBody {
  const merged: Task = { ...task, ...partial };
  let dockerImage: string | null = null;
  if (
    merged.runtime === 'docker' &&
    merged.docker_image !== null &&
    merged.docker_image.length > 0
  ) {
    dockerImage = merged.docker_image;
  }
  let glob: string | null = null;
  if (
    merged.trigger_type === 'save' &&
    merged.trigger_glob !== null &&
    merged.trigger_glob.length > 0
  ) {
    glob = merged.trigger_glob;
  }
  let cron: string | null = null;
  if (merged.trigger_type === 'scheduled') {
    cron = resolveCronExpression(merged.trigger_cron);
  }
  return {
    name: merged.name,
    command: merged.command,
    runtime: merged.runtime,
    docker_image: dockerImage,
    docker_platform: merged.docker_platform,
    trigger_type: merged.trigger_type,
    trigger_glob: glob,
    trigger_cron: cron,
    concurrency: merged.concurrency,
    enabled: merged.enabled,
  };
}

export async function patchTask(task: Task, partial: Partial<Task>): Promise<Task> {
  const body = buildTaskPatchBody(task, partial);
  const r = await api.updateTask(task.id, body);
  actions.upsertTask(r.task);
  toast.success('Saved');
  return r.task;
}
