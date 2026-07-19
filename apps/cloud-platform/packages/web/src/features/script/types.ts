export type RuntimeKind = 'shell' | 'docker';
export type TriggerKind = 'save' | 'manual' | 'startup' | 'scheduled';
export type ConcurrencyKind = 'restart' | 'queue' | 'ignore' | 'parallel';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type LogStream = 'out' | 'err';

export interface ProjectScriptSettings {
  project_id: string;
  paused: boolean;
  active_environment_id: string | null;
  created_at: number;
}

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  vars: Record<string, string>;
  created_at: number;
}

export interface Script {
  id: string;
  project_id: string;
  name: string;
  command: string;
  runtime: RuntimeKind;
  // Empty string means "unset" — optional depending on runtime/trigger_type, not absent data.
  docker_image: string;
  docker_platform: string;
  trigger_type: TriggerKind;
  trigger_glob: string;
  trigger_cron: string;
  concurrency: ConcurrencyKind;
  enabled: boolean;
  created_at: number;
}

export interface Execution {
  id: string;
  script_id: string;
  status: ExecutionStatus;
  started_at: number | null;
  ended_at: number | null;
  exit_code: number | null;
  trigger_reason: string;
  log_path: string;
}

export interface RunningSnapshot {
  executionId: string;
  scriptId: string;
  startedAt: number;
}

export type ServerMessage =
  | { kind: 'execution.started'; executionId: string; scriptId: string; ts: number }
  | { kind: 'execution.log'; executionId: string; line: string; stream: LogStream; ts: number }
  | {
      kind: 'execution.ended';
      executionId: string;
      status: ExecutionStatus;
      exitCode: number | null;
      ts: number;
    }
  | { kind: 'script.updated'; scriptId: string }
  | { kind: 'script.deleted'; scriptId: string }
  | { kind: 'project.updated'; projectId: string }
  | { kind: 'hello'; ts: number; running: RunningSnapshot[] };
