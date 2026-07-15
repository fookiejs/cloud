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

export function isProjectExportBundle(raw: unknown): raw is ProjectExportBundle {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const row = raw as Record<string, unknown>;
  if (row['format'] !== PROJECT_EXPORT_FORMAT) {
    return false;
  }
  if (row['version'] !== PROJECT_EXPORT_VERSION) {
    return false;
  }
  if (typeof row['project'] !== 'object' || row['project'] === null) {
    return false;
  }
  if (!Array.isArray(row['tasks'])) {
    return false;
  }
  return true;
}

export function exportFileName(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let base = slug;
  if (base.length === 0) {
    base = 'project';
  }
  return `${base}.lotaru-project.json`;
}

export function downloadProjectBundle(bundle: ProjectExportBundle, fileName: string): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
