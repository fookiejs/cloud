import { tsOrZero } from '@/lib/format';
import { taskHasLiveRunning } from '@/lib/task-running';
import type { Execution, ExecutionStatus } from '@/types';
import type { ExecutionRuntime } from '@/state/store';

export interface RunDot {
  id: string;
  status: ExecutionStatus | 'running';
  startedAt: number;
}

export function collectRunDots(
  taskId: string,
  history: readonly Execution[],
  liveLogs: readonly ExecutionRuntime[],
  liveExec: Record<string, ExecutionRuntime>,
): RunDot[] {
  const byId = new Map<string, RunDot>();

  const stillRunning = taskHasLiveRunning(taskId, liveExec, history);

  for (const key of Object.keys(liveExec)) {
    const e = liveExec[key];
    if (e === undefined) {
      continue;
    }
    if (e.taskId !== taskId) {
      continue;
    }
    let st: ExecutionStatus | 'running' = e.status;
    if (stillRunning && e.status === 'running') {
      st = 'running';
    } else if (e.status === 'running') {
      const hist = history.find((row) => row.id === e.id);
      if (hist !== undefined) {
        st = hist.status;
      }
    }
    byId.set(e.id, { id: e.id, status: st, startedAt: e.startedAt });
  }

  for (const rt of liveLogs) {
    let st: ExecutionStatus | 'running' = rt.status;
    if (stillRunning && rt.status === 'running') {
      st = 'running';
    } else if (rt.status === 'running') {
      const hist = history.find((row) => row.id === rt.id);
      if (hist !== undefined) {
        st = hist.status;
      }
    }
    byId.set(rt.id, { id: rt.id, status: st, startedAt: rt.startedAt });
  }

  for (const e of history) {
    if (byId.has(e.id)) {
      continue;
    }
    let st: ExecutionStatus | 'running' = e.status;
    if (e.status === 'running' || e.status === 'pending') {
      st = 'cancelled';
    }
    byId.set(e.id, { id: e.id, status: st, startedAt: tsOrZero(e.started_at) });
  }

  const list = Array.from(byId.values());
  list.sort((a, b) => b.startedAt - a.startedAt);
  return list.slice(0, 50);
}
