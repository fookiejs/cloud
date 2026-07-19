import { toast } from 'sonner';
import { api } from '@script/api/client';
import { resolveCronExpression } from '@script/lib/cron-presets';
import { actions } from '@script/state/store';
import type { Script } from '@script/types';

export type UpdateScriptBody = Omit<Script, 'id' | 'project_id' | 'created_at'>;

export function buildScriptPatchBody(script: Script, partial: Partial<Script>): UpdateScriptBody {
  const merged: Script = { ...script, ...partial };
  let dockerImage = '';
  if (merged.runtime === 'docker') {
    dockerImage = merged.docker_image;
  }
  let glob = '';
  if (merged.trigger_type === 'save') {
    glob = merged.trigger_glob;
  }
  let cron = '';
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

export async function patchScript(script: Script, partial: Partial<Script>): Promise<Script> {
  const body = buildScriptPatchBody(script, partial);
  const r = await api.updateScript(script.id, body);
  actions.upsertScript(r.script);
  toast.success('Saved');
  return r.script;
}
