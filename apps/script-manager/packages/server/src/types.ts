export type RuntimeKind = 'shell' | 'docker';
export type TriggerKind = 'save' | 'manual' | 'startup' | 'scheduled';
export type ConcurrencyKind = 'restart' | 'queue' | 'ignore' | 'parallel';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type LogStream = 'out' | 'err';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  paused: boolean;
  active_environment_id: string | null;
  created_at: number;
}

export interface Environment {
  id: string;
  workspace_id: string;
  name: string;
  vars: Record<string, string>;
  created_at: number;
}

export interface Task {
  id: string;
  workspace_id: string;
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
  created_at: number;
}

export interface Execution {
  id: string;
  task_id: string;
  status: ExecutionStatus;
  started_at: number | null;
  ended_at: number | null;
  exit_code: number | null;
  trigger_reason: string;
  log_path: string;
}

export interface TriggerReason {
  source: TriggerKind;
  detail: string;
}

export interface RunningSnapshot {
  executionId: string;
  taskId: string;
  startedAt: number;
}

export type ServerMessage =
  | { kind: 'execution.started'; executionId: string; taskId: string; ts: number }
  | { kind: 'execution.log'; executionId: string; line: string; stream: LogStream; ts: number }
  | {
      kind: 'execution.ended';
      executionId: string;
      status: ExecutionStatus;
      exitCode: number | null;
      ts: number;
    }
  | { kind: 'task.updated'; taskId: string }
  | { kind: 'task.deleted'; taskId: string }
  | { kind: 'workspace.updated'; workspaceId: string }
  | { kind: 'workspace.deleted'; workspaceId: string }
  | { kind: 'hello'; ts: number; running: RunningSnapshot[] };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(message: string): Result<T> {
  return { ok: false, error: message };
}
