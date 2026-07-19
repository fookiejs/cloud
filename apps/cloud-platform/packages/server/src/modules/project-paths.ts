import { join } from "node:path";

// Every per-project backing service (script sandbox, git checkout, code-server) shares
// ONE root folder per project so they can all see the same files. Do not give any
// feature its own private subdirectory naming scheme — that's how "workspace" silos
// crept back in last time.
export type ProjectPathsOptions = {
  dataDir: string;
  workspacesHostDir: string | null;
};

// Path as seen by THIS Node process (use for fs.*, child_process git commands, etc).
export function projectDir(options: ProjectPathsOptions, projectId: string): string {
  return join(options.dataDir, "workspaces", projectId);
}

// Path as seen by the Docker daemon for bind mounts. Differs from projectDir() only
// when this process itself runs inside a container talking to the host's Docker
// socket — bind-mount sources are always host paths, never paths inside the caller.
export function hostProjectDir(options: ProjectPathsOptions, projectId: string): string {
  if (options.workspacesHostDir !== null && options.workspacesHostDir.length > 0) {
    return `${options.workspacesHostDir.replace(/\/$/, "")}/${projectId}`;
  }
  return projectDir(options, projectId);
}
