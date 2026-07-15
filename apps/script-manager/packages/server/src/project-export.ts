import type { Store } from './db/index.js';
import type { ConcurrencyKind, RuntimeKind, TriggerKind } from './types.js';

export const PROJECT_EXPORT_FORMAT = 'lotaru-project';
export const PROJECT_EXPORT_VERSION = 1;

export interface ProjectExportTask {
  name: string;
  command: string;
  runtime: string;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: string;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: string;
  enabled: boolean;
}

export interface ProjectExportEnvironment {
  name: string;
  vars: Record<string, string>;
}

export interface ProjectExportProject {
  name: string;
  path: string;
  paused: boolean;
  active_environment_name: string | null;
}

export interface ProjectExportBundle {
  format: typeof PROJECT_EXPORT_FORMAT;
  version: number;
  exported_at: number;
  project: ProjectExportProject;
  environments: ProjectExportEnvironment[];
  tasks: ProjectExportTask[];
}

export interface TaskImportBody {
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

export interface ParsedImportBundle {
  project: ProjectExportProject;
  environments: ProjectExportEnvironment[];
  tasks: TaskImportBody[];
}

function taskToExport(task: {
  name: string;
  command: string;
  runtime: string;
  docker_image: string | null;
  docker_platform: string | null;
  trigger_type: string;
  trigger_glob: string | null;
  trigger_cron: string | null;
  concurrency: string;
  enabled: boolean;
}): ProjectExportTask {
  return {
    name: task.name,
    command: task.command,
    runtime: task.runtime,
    docker_image: task.docker_image,
    docker_platform: task.docker_platform,
    trigger_type: task.trigger_type,
    trigger_glob: task.trigger_glob,
    trigger_cron: task.trigger_cron,
    concurrency: task.concurrency,
    enabled: task.enabled,
  };
}

export function buildProjectExportBundle(
  store: Store,
  workspaceId: string,
): ProjectExportBundle | null {
  const w = store.getWorkspace(workspaceId);
  if (w === null) {
    return null;
  }
  const environments = store.listEnvironments(w.id);
  let activeName: string | null = null;
  if (w.active_environment_id !== null) {
    for (const env of environments) {
      if (env.id === w.active_environment_id) {
        activeName = env.name;
      }
    }
  }
  const envExport: ProjectExportEnvironment[] = [];
  for (const env of environments) {
    envExport.push({ name: env.name, vars: env.vars });
  }
  const tasks = store.listTasks(w.id);
  const taskExport: ProjectExportTask[] = [];
  for (const task of tasks) {
    taskExport.push(taskToExport(task));
  }
  return {
    format: PROJECT_EXPORT_FORMAT,
    version: PROJECT_EXPORT_VERSION,
    exported_at: Date.now(),
    project: {
      name: w.name,
      path: w.path,
      paused: w.paused,
      active_environment_name: activeName,
    },
    environments: envExport,
    tasks: taskExport,
  };
}

function parseEnvironment(raw: unknown): ProjectExportEnvironment | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'environment must be object';
  }
  const row = raw as Record<string, unknown>;
  if (typeof row['name'] !== 'string' || row['name'].length === 0) {
    return 'environment name required';
  }
  if (row['vars'] === undefined) {
    return { name: row['name'], vars: {} };
  }
  if (typeof row['vars'] !== 'object' || row['vars'] === null) {
    return 'environment vars must be object';
  }
  const vars: Record<string, string> = {};
  const varsObj = row['vars'] as Record<string, unknown>;
  for (const key of Object.keys(varsObj)) {
    const val = varsObj[key];
    if (typeof val !== 'string') {
      return `environment var ${key} must be string`;
    }
    vars[key] = val;
  }
  return { name: row['name'], vars };
}

export function parseProjectImportBundle(
  raw: unknown,
  validateTask: (body: unknown) => TaskImportBody | string,
): ParsedImportBundle | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'bundle must be object';
  }
  const bundle = raw as Record<string, unknown>;
  if (bundle['format'] !== PROJECT_EXPORT_FORMAT) {
    return 'invalid format';
  }
  if (bundle['version'] !== PROJECT_EXPORT_VERSION) {
    return 'unsupported version';
  }
  if (typeof bundle['project'] !== 'object' || bundle['project'] === null) {
    return 'project required';
  }
  const projectRaw = bundle['project'] as Record<string, unknown>;
  if (typeof projectRaw['name'] !== 'string' || projectRaw['name'].length === 0) {
    return 'project name required';
  }
  if (typeof projectRaw['path'] !== 'string' || projectRaw['path'].length === 0) {
    return 'project path required';
  }
  let paused = false;
  if (projectRaw['paused'] !== undefined) {
    if (typeof projectRaw['paused'] !== 'boolean') {
      return 'project paused must be boolean';
    }
    paused = projectRaw['paused'];
  }
  let activeName: string | null = null;
  if (
    projectRaw['active_environment_name'] !== undefined &&
    projectRaw['active_environment_name'] !== null
  ) {
    if (typeof projectRaw['active_environment_name'] !== 'string') {
      return 'active_environment_name must be string or null';
    }
    activeName = projectRaw['active_environment_name'];
  }
  const project: ProjectExportProject = {
    name: projectRaw['name'],
    path: projectRaw['path'],
    paused,
    active_environment_name: activeName,
  };
  const environments: ProjectExportEnvironment[] = [];
  if (bundle['environments'] !== undefined) {
    if (!Array.isArray(bundle['environments'])) {
      return 'environments must be array';
    }
    for (const row of bundle['environments']) {
      const parsed = parseEnvironment(row);
      if (typeof parsed === 'string') {
        return parsed;
      }
      environments.push(parsed);
    }
  }
  const tasks: TaskImportBody[] = [];
  if (bundle['tasks'] === undefined) {
    return 'tasks required';
  }
  if (!Array.isArray(bundle['tasks'])) {
    return 'tasks must be array';
  }
  for (const row of bundle['tasks']) {
    const parsed = validateTask(row);
    if (typeof parsed === 'string') {
      return parsed;
    }
    tasks.push(parsed);
  }
  return { project, environments, tasks };
}

export function resolveImportProjectMeta(
  parsed: ParsedImportBundle,
  nameOverride: string | undefined,
  pathOverride: string,
): ProjectExportProject {
  let name = parsed.project.name;
  if (nameOverride !== undefined && nameOverride.length > 0) {
    name = nameOverride;
  }
  return {
    name,
    path: pathOverride,
    paused: parsed.project.paused,
    active_environment_name: parsed.project.active_environment_name,
  };
}
