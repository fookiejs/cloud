import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../api/client.js';
import { connectStream } from '../api/stream.js';
import type {
  Workspace,
  Task,
  Execution,
  ExecutionStatus,
  RunningSnapshot,
  ServerMessage,
} from '../types.js';

interface ExecutionRuntime {
  id: string;
  taskId: string;
  status: ExecutionStatus | 'running';
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  logLines: { stream: 'out' | 'err'; line: string; ts: number }[];
}

interface State {
  workspaces: Workspace[];
  tasksByWorkspace: Record<string, Task[]>;
  recentExecutions: Execution[];
  executionsByTask: Record<string, Execution[]>;
  liveExecutions: Record<string, ExecutionRuntime>;
  liveLogsByTask: Record<string, ExecutionRuntime[]>;
}

const initial: State = {
  workspaces: [],
  tasksByWorkspace: {},
  recentExecutions: [],
  executionsByTask: {},
  liveExecutions: {},
  liveLogsByTask: {},
};

type Listener = () => void;

let state: State = initial;
const listeners = new Set<Listener>();

function set(updater: (s: State) => State): void {
  state = updater(state);
  for (const l of listeners) {
    l();
  }
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getState(): State {
  return state;
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initial),
  );
}

const EMPTY_TASKS: readonly Task[] = Object.freeze([]);
const EMPTY_EXECUTIONS: readonly Execution[] = Object.freeze([]);
const EMPTY_RUNTIMES: readonly ExecutionRuntime[] = Object.freeze([]);

export function selectTasksOf(s: State, workspaceId: string): readonly Task[] {
  const list = s.tasksByWorkspace[workspaceId];
  if (list === undefined) {
    return EMPTY_TASKS;
  }
  return list;
}

export function selectExecutionsOf(s: State, taskId: string): readonly Execution[] {
  const list = s.executionsByTask[taskId];
  if (list === undefined) {
    return EMPTY_EXECUTIONS;
  }
  return list;
}

export function selectLiveLogsOf(s: State, taskId: string): readonly ExecutionRuntime[] {
  const list = s.liveLogsByTask[taskId];
  if (list === undefined) {
    return EMPTY_RUNTIMES;
  }
  return list;
}

const executionRefreshAt = new Map<string, number>();

function scheduleExecutionRefresh(taskId: string, delayMs: number): void {
  const now = Date.now();
  const last = executionRefreshAt.get(taskId);
  if (last !== undefined && now - last < delayMs) {
    return;
  }
  executionRefreshAt.set(taskId, now);
  void actions.refreshExecutionsForTask(taskId);
}

function mergeRunningExecution(
  executionsByTask: Record<string, Execution[]>,
  row: RunningSnapshot,
): void {
  const stub: Execution = {
    id: row.executionId,
    task_id: row.taskId,
    status: 'running',
    started_at: row.startedAt,
    ended_at: null,
    exit_code: null,
    trigger_reason: 'live',
    log_path: '',
  };
  const list = executionsByTask[row.taskId];
  if (list === undefined) {
    executionsByTask[row.taskId] = [stub];
    return;
  }
  let found = false;
  const next: Execution[] = [];
  for (const e of list) {
    if (e.id === row.executionId) {
      found = true;
      next.push({
        ...e,
        status: 'running',
        started_at: row.startedAt,
        ended_at: null,
        exit_code: null,
      });
    } else {
      next.push(e);
    }
  }
  if (!found) {
    executionsByTask[row.taskId] = [stub, ...list];
    return;
  }
  executionsByTask[row.taskId] = next;
}

function reconcileLiveLogRow(
  taskId: string,
  logRow: ExecutionRuntime,
  runningIds: ReadonlySet<string>,
  executionsByTask: Record<string, Execution[]>,
): ExecutionRuntime | null {
  if (runningIds.has(logRow.id)) {
    return logRow;
  }
  if (logRow.status !== 'running') {
    return logRow;
  }
  const history = executionsByTask[taskId];
  if (history !== undefined) {
    for (const row of history) {
      if (row.id !== logRow.id) {
        continue;
      }
      if (row.ended_at !== null) {
        return {
          ...logRow,
          status: row.status,
          endedAt: row.ended_at,
          exitCode: row.exit_code,
        };
      }
      break;
    }
  }
  return null;
}

function applyRunningSnapshot(s: State, running: readonly RunningSnapshot[]): State {
  const runningIds = new Set(running.map((row) => row.executionId));
  const liveExecutions: Record<string, ExecutionRuntime> = {};
  const liveLogsByTask = { ...s.liveLogsByTask };
  const executionsByTask = { ...s.executionsByTask };

  for (const row of running) {
    const existing = s.liveExecutions[row.executionId];
    let logLines: ExecutionRuntime['logLines'] = [];
    if (existing !== undefined) {
      logLines = existing.logLines;
    }
    const rt: ExecutionRuntime = {
      id: row.executionId,
      taskId: row.taskId,
      status: 'running',
      startedAt: row.startedAt,
      endedAt: null,
      exitCode: null,
      logLines,
    };
    liveExecutions[row.executionId] = rt;
    mergeRunningExecution(executionsByTask, row);

    const taskLogs = liveLogsByTask[row.taskId];
    let nextList: ExecutionRuntime[] = [rt];
    if (taskLogs !== undefined) {
      const filtered: ExecutionRuntime[] = [];
      for (const logRow of taskLogs) {
        if (logRow.id !== row.executionId) {
          filtered.push(logRow);
        }
      }
      nextList = [rt, ...filtered].slice(0, 5);
    }
    liveLogsByTask[row.taskId] = nextList;
  }

  for (const taskId of Object.keys(liveLogsByTask)) {
    const logs = liveLogsByTask[taskId];
    if (logs === undefined) {
      continue;
    }
    const next: ExecutionRuntime[] = [];
    for (const logRow of logs) {
      const reconciled = reconcileLiveLogRow(taskId, logRow, runningIds, executionsByTask);
      if (reconciled !== null) {
        next.push(reconciled);
      }
    }
    if (next.length === 0) {
      delete liveLogsByTask[taskId];
    } else {
      liveLogsByTask[taskId] = next;
    }
  }

  return { ...s, liveExecutions, liveLogsByTask, executionsByTask };
}

export const actions = {
  async refreshWorkspaces(): Promise<void> {
    const r = await api.listWorkspaces();
    set((s) => ({ ...s, workspaces: r.workspaces }));
  },
  async refreshTasks(workspaceId: string): Promise<void> {
    const r = await api.listTasks(workspaceId);
    set((s) => ({ ...s, tasksByWorkspace: { ...s.tasksByWorkspace, [workspaceId]: r.tasks } }));
  },
  upsertTask(task: Task): void {
    set((s) => {
      const list = s.tasksByWorkspace[task.workspace_id];
      if (list === undefined) {
        const tasksByWorkspace = { ...s.tasksByWorkspace, [task.workspace_id]: [task] };
        return { ...s, tasksByWorkspace };
      }
      const next: Task[] = [];
      let found = false;
      for (const row of list) {
        if (row.id === task.id) {
          next.push(task);
          found = true;
        } else {
          next.push(row);
        }
      }
      if (!found) {
        next.push(task);
      }
      const tasksByWorkspace = { ...s.tasksByWorkspace, [task.workspace_id]: next };
      return { ...s, tasksByWorkspace };
    });
  },
  async syncTask(taskId: string): Promise<void> {
    try {
      const r = await api.getTask(taskId);
      actions.upsertTask(r.task);
    } catch (_e: unknown) {}
  },
  removeTask(taskId: string): void {
    set((s) => {
      const tasksByWorkspace: Record<string, Task[]> = { ...s.tasksByWorkspace };
      for (const key of Object.keys(tasksByWorkspace)) {
        const list = tasksByWorkspace[key];
        if (list === undefined) {
          continue;
        }
        const next: Task[] = [];
        for (const row of list) {
          if (row.id !== taskId) {
            next.push(row);
          }
        }
        if (next.length !== list.length) {
          tasksByWorkspace[key] = next;
        }
      }
      return { ...s, tasksByWorkspace };
    });
  },
  mergeWorkspaceTasks(workspaceId: string, pageTasks: readonly Task[]): void {
    set((s) => {
      const list = s.tasksByWorkspace[workspaceId];
      const byId = new Map<string, Task>();
      if (list !== undefined) {
        for (const row of list) {
          byId.set(row.id, row);
        }
      }
      for (const row of pageTasks) {
        byId.set(row.id, row);
      }
      const merged: Task[] = [];
      for (const row of byId.values()) {
        merged.push(row);
      }
      const tasksByWorkspace = { ...s.tasksByWorkspace, [workspaceId]: merged };
      return { ...s, tasksByWorkspace };
    });
  },
  async refreshRecentExecutions(): Promise<void> {
    const r = await api.listExecutions(null, 30);
    set((s) => ({ ...s, recentExecutions: r.executions }));
  },
  async refreshRunningExecutions(): Promise<void> {
    const r = await api.listRunningExecutions();
    set((s) => applyRunningSnapshot(s, r.running));
  },
  async refreshExecutionsForTask(taskId: string, limit = 20): Promise<void> {
    const r = await api.listExecutions(taskId, limit);
    set((s) => ({
      ...s,
      executionsByTask: { ...s.executionsByTask, [taskId]: r.executions },
    }));
  },
  async prefetchExecutionsForTasks(taskIds: readonly string[], limit = 20): Promise<void> {
    if (taskIds.length === 0) {
      return;
    }
    const rows = await Promise.all(
      taskIds.map(async (taskId) => {
        const r = await api.listExecutions(taskId, limit);
        return { taskId, executions: r.executions };
      }),
    );
    set((s) => {
      const executionsByTask = { ...s.executionsByTask };
      for (const row of rows) {
        executionsByTask[row.taskId] = row.executions;
      }
      return { ...s, executionsByTask };
    });
  },
  async refreshExecutionsForWorkspace(workspaceId: string): Promise<void> {
    const tasks = selectTasksOf(state, workspaceId);
    const ids: string[] = [];
    for (const t of tasks) {
      ids.push(t.id);
    }
    await actions.prefetchExecutionsForTasks(ids, 20);
  },
};

function handleMessage(msg: ServerMessage): void {
  if (msg.kind === 'hello') {
    let rows: RunningSnapshot[] = [];
    if (Array.isArray(msg.running)) {
      rows = msg.running;
    }
    set((s) => applyRunningSnapshot(s, rows));
    return;
  }
  if (msg.kind === 'execution.started') {
    scheduleExecutionRefresh(msg.taskId, 1500);
    set((s) => {
      const rt: ExecutionRuntime = {
        id: msg.executionId,
        taskId: msg.taskId,
        status: 'running',
        startedAt: msg.ts,
        endedAt: null,
        exitCode: null,
        logLines: [],
      };
      const taskLogs = s.liveLogsByTask[msg.taskId];
      let nextList: ExecutionRuntime[] = [rt];
      if (taskLogs !== undefined) {
        nextList = [rt, ...taskLogs].slice(0, 5);
      }
      return {
        ...s,
        liveExecutions: { ...s.liveExecutions, [msg.executionId]: rt },
        liveLogsByTask: { ...s.liveLogsByTask, [msg.taskId]: nextList },
      };
    });
    return;
  }
  if (msg.kind === 'execution.log') {
    set((s) => {
      const existing = s.liveExecutions[msg.executionId];
      if (existing === undefined) {
        return s;
      }
      const lines = [...existing.logLines, { stream: msg.stream, line: msg.line, ts: msg.ts }];
      const trimmed = lines.slice(-2000);
      const updated: ExecutionRuntime = { ...existing, logLines: trimmed };
      const taskLogs = s.liveLogsByTask[existing.taskId];
      let nextList = taskLogs;
      if (taskLogs !== undefined) {
        nextList = taskLogs.map((e) => {
          if (e.id === existing.id) {
            return updated;
          }
          return e;
        });
      }
      const liveLogsByTask = { ...s.liveLogsByTask };
      if (nextList !== undefined) {
        liveLogsByTask[existing.taskId] = nextList;
      }
      return {
        ...s,
        liveExecutions: { ...s.liveExecutions, [msg.executionId]: updated },
        liveLogsByTask,
      };
    });
    return;
  }
  if (msg.kind === 'execution.ended') {
    set((s) => {
      const existing = s.liveExecutions[msg.executionId];
      let taskId: string | undefined;
      if (existing !== undefined) {
        taskId = existing.taskId;
      }
      if (taskId === undefined) {
        for (const key of Object.keys(s.liveLogsByTask)) {
          const logs = s.liveLogsByTask[key];
          if (logs === undefined) {
            continue;
          }
          for (const row of logs) {
            if (row.id === msg.executionId) {
              taskId = key;
              break;
            }
          }
          if (taskId !== undefined) {
            break;
          }
        }
      }
      if (taskId === undefined) {
        const liveExecNext: Record<string, ExecutionRuntime> = {};
        for (const key of Object.keys(s.liveExecutions)) {
          if (key !== msg.executionId) {
            const row = s.liveExecutions[key];
            if (row !== undefined) {
              liveExecNext[key] = row;
            }
          }
        }
        if (Object.keys(liveExecNext).length === Object.keys(s.liveExecutions).length) {
          return s;
        }
        return { ...s, liveExecutions: liveExecNext };
      }

      let startedAt = msg.ts;
      if (existing !== undefined) {
        startedAt = existing.startedAt;
      }
      let logLines: ExecutionRuntime['logLines'] = [];
      if (existing !== undefined) {
        logLines = existing.logLines;
      }
      const updated: ExecutionRuntime = {
        id: msg.executionId,
        taskId,
        status: msg.status,
        startedAt,
        endedAt: msg.ts,
        exitCode: msg.exitCode,
        logLines,
      };
      const taskLogs = s.liveLogsByTask[taskId];
      let nextList: ExecutionRuntime[];
      if (taskLogs !== undefined) {
        let matchIndex = -1;
        for (let i = 0; i < taskLogs.length; i++) {
          const row = taskLogs[i];
          if (row === undefined) {
            continue;
          }
          if (row.id === msg.executionId) {
            matchIndex = i;
            break;
          }
        }
        if (matchIndex >= 0) {
          nextList = taskLogs.map((row, i) => {
            if (i === matchIndex) {
              return updated;
            }
            return row;
          });
        } else {
          nextList = [updated, ...taskLogs].slice(0, 5);
        }
      } else {
        nextList = [updated];
      }
      const liveLogsByTask = { ...s.liveLogsByTask, [taskId]: nextList };
      void actions.refreshRecentExecutions();
      scheduleExecutionRefresh(taskId, 800);
      const endedExec: Execution = {
        id: msg.executionId,
        task_id: taskId,
        status: msg.status,
        started_at: startedAt,
        ended_at: msg.ts,
        exit_code: msg.exitCode,
        trigger_reason: 'live',
        log_path: '',
      };
      const prev = s.executionsByTask[taskId];
      let nextHist: Execution[] = [endedExec];
      if (prev !== undefined) {
        const filtered: Execution[] = [];
        for (const row of prev) {
          if (row.id !== msg.executionId) {
            filtered.push(row);
          }
        }
        nextHist = [endedExec, ...filtered];
      }
      if (nextHist.length > 20) {
        nextHist = nextHist.slice(0, 20);
      }
      const liveExecNext: Record<string, ExecutionRuntime> = {};
      for (const key of Object.keys(s.liveExecutions)) {
        if (key !== msg.executionId) {
          const row = s.liveExecutions[key];
          if (row !== undefined) {
            liveExecNext[key] = row;
          }
        }
      }
      return {
        ...s,
        liveExecutions: liveExecNext,
        liveLogsByTask,
        executionsByTask: {
          ...s.executionsByTask,
          [taskId]: nextHist,
        },
      };
    });
    return;
  }
  if (msg.kind === 'workspace.updated' || msg.kind === 'workspace.deleted') {
    void actions.refreshWorkspaces();
    return;
  }
  if (msg.kind === 'task.updated') {
    void actions.syncTask(msg.taskId);
    return;
  }
  actions.removeTask(msg.taskId);
}

export function useBootstrap(): { ready: boolean } {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const stream = connectStream();
    const unsub = stream.subscribe(handleMessage);
    void (async () => {
      try {
        await actions.refreshWorkspaces();
        await actions.refreshRunningExecutions();
        const ws = state.workspaces;
        for (const w of ws) {
          await actions.refreshTasks(w.id);
          const taskList = selectTasksOf(state, w.id);
          const ids: string[] = [];
          for (const t of taskList) {
            ids.push(t.id);
          }
          await actions.prefetchExecutionsForTasks(ids, 20);
        }
        await actions.refreshRecentExecutions();
        await actions.refreshRunningExecutions();
      } catch {
        void 0;
      } finally {
        setReady(true);
      }
    })();
    return () => {
      unsub();
      stream.close();
    };
  }, []);
  return { ready };
}

export type { ExecutionRuntime };
