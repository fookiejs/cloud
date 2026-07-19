import { buildScriptPatchBody } from '@script/lib/script-patch';
import type { UpdateScriptBody } from '@script/lib/script-patch';
import type { Script } from '@script/types';

export type ScriptCreateBody = UpdateScriptBody;

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  scripts: readonly ScriptCreateBody[];
}

export const EMPTY_PROJECT_TEMPLATE_ID = 'empty';

const TS_GLOB = '**/*.{ts,tsx,js,jsx,json}';

const NODEJS_SCRIPTS: readonly ScriptCreateBody[] = [
  {
    name: 'build',
    command: 'npm run build',
    runtime: 'shell',
    docker_image: '',
    docker_platform: '',
    trigger_type: 'save',
    trigger_glob: TS_GLOB,
    trigger_cron: '',
    concurrency: 'restart',
    enabled: true,
  },
  {
    name: 'lint',
    command: 'npm run lint',
    runtime: 'shell',
    docker_image: '',
    docker_platform: '',
    trigger_type: 'save',
    trigger_glob: TS_GLOB,
    trigger_cron: '',
    concurrency: 'queue',
    enabled: true,
  },
  {
    name: 'typecheck',
    command: 'npm run typecheck',
    runtime: 'shell',
    docker_image: '',
    docker_platform: '',
    trigger_type: 'save',
    trigger_glob: '**/*.{ts,tsx}',
    trigger_cron: '',
    concurrency: 'queue',
    enabled: true,
  },
  {
    name: 'test',
    command: 'npm test',
    runtime: 'shell',
    docker_image: '',
    docker_platform: '',
    trigger_type: 'manual',
    trigger_glob: '',
    trigger_cron: '',
    concurrency: 'ignore',
    enabled: true,
  },
  {
    name: 'dev',
    command: 'npm run dev',
    runtime: 'shell',
    docker_image: '',
    docker_platform: '',
    trigger_type: 'startup',
    trigger_glob: '',
    trigger_cron: '',
    concurrency: 'restart',
    enabled: true,
  },
];

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: EMPTY_PROJECT_TEMPLATE_ID,
    label: 'Empty',
    description: 'No scripts — add your own',
    scripts: [],
  },
  {
    id: 'nodejs',
    label: 'Node.js',
    description: 'build, lint, typecheck, test, dev',
    scripts: NODEJS_SCRIPTS,
  },
];

export const BLANK_SCRIPT_BODY: ScriptCreateBody = {
  name: 'New script',
  command: 'echo hello',
  runtime: 'shell',
  docker_image: '',
  docker_platform: '',
  trigger_type: 'manual',
  trigger_glob: '',
  trigger_cron: '',
  concurrency: 'restart',
  enabled: true,
};

export function projectTemplateScripts(templateId: string): readonly ScriptCreateBody[] {
  for (const row of PROJECT_TEMPLATES) {
    if (row.id === templateId) {
      return row.scripts;
    }
  }
  return [];
}

export function uniqueScriptName(base: string, existingNames: readonly string[]): string {
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

export function duplicateScriptBody(script: Script, existingNames: readonly string[]): ScriptCreateBody {
  const name = uniqueScriptName(script.name, existingNames);
  return buildScriptPatchBody(script, { name });
}
