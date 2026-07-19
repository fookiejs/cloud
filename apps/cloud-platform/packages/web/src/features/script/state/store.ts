import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../api/client.js';
import { connectStream } from '../api/stream.js';
import type {
  ProjectScriptSettings,
  Script,
  Execution,
  ExecutionStatus,
  RunningSnapshot,
  ServerMessage,
} from '../types.js';

interface ExecutionRuntime {
  id: string;
  scriptId: string;
  status: ExecutionStatus | 'running';
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  logLines: { stream: 'out' | 'err'; line: string; ts: number }[];
}

interface State {
  settings: ProjectScriptSettings | null;
  scripts: Script[];
  executionsByScript: Record<string, Execution[]>;
  liveExecutions: Record<string, ExecutionRuntime>;
  liveLogsByScript: Record<string, ExecutionRuntime[]>;
}

const initial: State = {
  settings: null,
  scripts: [],
  executionsByScript: {},
  liveExecutions: {},
  liveLogsByScript: {},
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

const EMPTY_EXECUTIONS: readonly Execution[] = Object.freeze([]);
const EMPTY_RUNTIMES: readonly ExecutionRuntime[] = Object.freeze([]);

export function selectExecutionsOf(s: State, scriptId: string): readonly Execution[] {
  const list = s.executionsByScript[scriptId];
  if (list === undefined) {
    return EMPTY_EXECUTIONS;
  }
  return list;
}

export function selectLiveLogsOf(s: State, scriptId: string): readonly ExecutionRuntime[] {
  const list = s.liveLogsByScript[scriptId];
  if (list === undefined) {
    return EMPTY_RUNTIMES;
  }
  return list;
}

const executionRefreshAt = new Map<string, number>();

function scheduleExecutionRefresh(scriptId: string, delayMs: number): void {
  const now = Date.now();
  const last = executionRefreshAt.get(scriptId);
  if (last !== undefined && now - last < delayMs) {
    return;
  }
  executionRefreshAt.set(scriptId, now);
  void actions.refreshExecutionsForScript(scriptId);
}

function mergeRunningExecution(
  executionsByScript: Record<string, Execution[]>,
  row: RunningSnapshot,
): void {
  const stub: Execution = {
    id: row.executionId,
    script_id: row.scriptId,
    status: 'running',
    started_at: row.startedAt,
    ended_at: null,
    exit_code: null,
    trigger_reason: 'live',
    log_path: '',
  };
  const list = executionsByScript[row.scriptId];
  if (list === undefined) {
    executionsByScript[row.scriptId] = [stub];
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
    executionsByScript[row.scriptId] = [stub, ...list];
    return;
  }
  executionsByScript[row.scriptId] = next;
}

function reconcileLiveLogRow(
  scriptId: string,
  logRow: ExecutionRuntime,
  runningIds: ReadonlySet<string>,
  executionsByScript: Record<string, Execution[]>,
): ExecutionRuntime | null {
  if (runningIds.has(logRow.id)) {
    return logRow;
  }
  if (logRow.status !== 'running') {
    return logRow;
  }
  const history = executionsByScript[scriptId];
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
  const liveLogsByScript = { ...s.liveLogsByScript };
  const executionsByScript = { ...s.executionsByScript };

  for (const row of running) {
    const existing = s.liveExecutions[row.executionId];
    let logLines: ExecutionRuntime['logLines'] = [];
    if (existing !== undefined) {
      logLines = existing.logLines;
    }
    const rt: ExecutionRuntime = {
      id: row.executionId,
      scriptId: row.scriptId,
      status: 'running',
      startedAt: row.startedAt,
      endedAt: null,
      exitCode: null,
      logLines,
    };
    liveExecutions[row.executionId] = rt;
    mergeRunningExecution(executionsByScript, row);

    const scriptLogs = liveLogsByScript[row.scriptId];
    let nextList: ExecutionRuntime[] = [rt];
    if (scriptLogs !== undefined) {
      const filtered: ExecutionRuntime[] = [];
      for (const logRow of scriptLogs) {
        if (logRow.id !== row.executionId) {
          filtered.push(logRow);
        }
      }
      nextList = [rt, ...filtered].slice(0, 5);
    }
    liveLogsByScript[row.scriptId] = nextList;
  }

  for (const scriptId of Object.keys(liveLogsByScript)) {
    const logs = liveLogsByScript[scriptId];
    if (logs === undefined) {
      continue;
    }
    const next: ExecutionRuntime[] = [];
    for (const logRow of logs) {
      const reconciled = reconcileLiveLogRow(scriptId, logRow, runningIds, executionsByScript);
      if (reconciled !== null) {
        next.push(reconciled);
      }
    }
    if (next.length === 0) {
      delete liveLogsByScript[scriptId];
    } else {
      liveLogsByScript[scriptId] = next;
    }
  }

  return { ...s, liveExecutions, liveLogsByScript, executionsByScript };
}

let currentProjectId: string | undefined;

export const actions = {
  setSettings(settings: ProjectScriptSettings): void {
    set((s) => ({ ...s, settings }));
  },
  async refreshScripts(projectId: string): Promise<void> {
    const r = await api.listScripts(projectId);
    set((s) => ({ ...s, scripts: r.scripts }));
  },
  upsertScript(script: Script): void {
    set((s) => {
      const next: Script[] = [];
      let found = false;
      for (const row of s.scripts) {
        if (row.id === script.id) {
          next.push(script);
          found = true;
        } else {
          next.push(row);
        }
      }
      if (!found) {
        next.push(script);
      }
      return { ...s, scripts: next };
    });
  },
  async syncScript(scriptId: string): Promise<void> {
    try {
      const r = await api.getScript(scriptId);
      actions.upsertScript(r.script);
    } catch (_e: unknown) {}
  },
  removeScript(scriptId: string): void {
    set((s) => {
      const next: Script[] = [];
      for (const row of s.scripts) {
        if (row.id !== scriptId) {
          next.push(row);
        }
      }
      return { ...s, scripts: next };
    });
  },
  async refreshRunningExecutions(): Promise<void> {
    const r = await api.listRunningExecutions();
    set((s) => applyRunningSnapshot(s, r.running));
  },
  async refreshExecutionsForScript(scriptId: string, limit = 20): Promise<void> {
    const r = await api.listExecutions(scriptId, limit);
    set((s) => ({
      ...s,
      executionsByScript: { ...s.executionsByScript, [scriptId]: r.executions },
    }));
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
    scheduleExecutionRefresh(msg.scriptId, 1500);
    set((s) => {
      const rt: ExecutionRuntime = {
        id: msg.executionId,
        scriptId: msg.scriptId,
        status: 'running',
        startedAt: msg.ts,
        endedAt: null,
        exitCode: null,
        logLines: [],
      };
      const scriptLogs = s.liveLogsByScript[msg.scriptId];
      let nextList: ExecutionRuntime[] = [rt];
      if (scriptLogs !== undefined) {
        nextList = [rt, ...scriptLogs].slice(0, 5);
      }
      return {
        ...s,
        liveExecutions: { ...s.liveExecutions, [msg.executionId]: rt },
        liveLogsByScript: { ...s.liveLogsByScript, [msg.scriptId]: nextList },
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
      const scriptLogs = s.liveLogsByScript[existing.scriptId];
      let nextList = scriptLogs;
      if (scriptLogs !== undefined) {
        nextList = scriptLogs.map((e) => {
          if (e.id === existing.id) {
            return updated;
          }
          return e;
        });
      }
      const liveLogsByScript = { ...s.liveLogsByScript };
      if (nextList !== undefined) {
        liveLogsByScript[existing.scriptId] = nextList;
      }
      return {
        ...s,
        liveExecutions: { ...s.liveExecutions, [msg.executionId]: updated },
        liveLogsByScript,
      };
    });
    return;
  }
  if (msg.kind === 'execution.ended') {
    set((s) => {
      const existing = s.liveExecutions[msg.executionId];
      let scriptId: string | undefined;
      if (existing !== undefined) {
        scriptId = existing.scriptId;
      }
      if (scriptId === undefined) {
        for (const key of Object.keys(s.liveLogsByScript)) {
          const logs = s.liveLogsByScript[key];
          if (logs === undefined) {
            continue;
          }
          for (const row of logs) {
            if (row.id === msg.executionId) {
              scriptId = key;
              break;
            }
          }
          if (scriptId !== undefined) {
            break;
          }
        }
      }
      if (scriptId === undefined) {
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
        scriptId,
        status: msg.status,
        startedAt,
        endedAt: msg.ts,
        exitCode: msg.exitCode,
        logLines,
      };
      const scriptLogs = s.liveLogsByScript[scriptId];
      let nextList: ExecutionRuntime[];
      if (scriptLogs !== undefined) {
        let matchIndex = -1;
        for (let i = 0; i < scriptLogs.length; i++) {
          const row = scriptLogs[i];
          if (row === undefined) {
            continue;
          }
          if (row.id === msg.executionId) {
            matchIndex = i;
            break;
          }
        }
        if (matchIndex >= 0) {
          nextList = scriptLogs.map((row, i) => {
            if (i === matchIndex) {
              return updated;
            }
            return row;
          });
        } else {
          nextList = [updated, ...scriptLogs].slice(0, 5);
        }
      } else {
        nextList = [updated];
      }
      const liveLogsByScript = { ...s.liveLogsByScript, [scriptId]: nextList };
      scheduleExecutionRefresh(scriptId, 800);
      const endedExec: Execution = {
        id: msg.executionId,
        script_id: scriptId,
        status: msg.status,
        started_at: startedAt,
        ended_at: msg.ts,
        exit_code: msg.exitCode,
        trigger_reason: 'live',
        log_path: '',
      };
      const prev = s.executionsByScript[scriptId];
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
        liveLogsByScript,
        executionsByScript: {
          ...s.executionsByScript,
          [scriptId]: nextHist,
        },
      };
    });
    return;
  }
  if (msg.kind === 'project.updated') {
    if (currentProjectId !== undefined) {
      void api.getScriptSnapshot(currentProjectId).then((snapshot) => {
        actions.setSettings(snapshot.settings);
      });
    }
    return;
  }
  if (msg.kind === 'script.updated') {
    void actions.syncScript(msg.scriptId);
    return;
  }
  actions.removeScript(msg.scriptId);
}

export function useBootstrap(projectId?: string): { ready: boolean } {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    currentProjectId = projectId;
    setReady(false);
    if (projectId === undefined) {
      return;
    }
    const stream = connectStream();
    const unsub = stream.subscribe(handleMessage);
    void (async () => {
      try {
        const snapshot = await api.getScriptSnapshot(projectId);
        set((s) => {
          const executionsByScript: Record<string, Execution[]> = {};
          for (const script of snapshot.scripts) {
            executionsByScript[script.id] = [];
          }
          for (const exec of snapshot.executions) {
            const list = executionsByScript[exec.script_id];
            if (list === undefined) {
              executionsByScript[exec.script_id] = [exec];
            } else {
              list.push(exec);
            }
          }
          return {
            ...s,
            settings: snapshot.settings,
            scripts: snapshot.scripts,
            executionsByScript,
          };
        });
        await actions.refreshRunningExecutions();
      } catch {
      } finally {
        setReady(true);
      }
    })();
    return () => {
      unsub();
      stream.close();
    };
  }, [projectId]);
  return { ready };
}

export type { ExecutionRuntime };
