import type { ConcurrencyKind, TriggerReason } from '../types.js';

export type { TriggerReason };

export type SlotState =
  | { kind: 'idle' }
  | { kind: 'running'; executionId: string }
  | { kind: 'running_with_queued'; executionId: string; next: TriggerReason }
  | { kind: 'cancelling_then_start'; executionId: string; next: TriggerReason }
  | { kind: 'parallel'; running: readonly string[] };

export type PolicyEvent =
  | { kind: 'trigger'; reason: TriggerReason }
  | { kind: 'started'; executionId: string }
  | { kind: 'ended'; executionId: string };

export type Command =
  | { kind: 'start'; reason: TriggerReason }
  | { kind: 'cancel'; executionId: string }
  | { kind: 'drop' };

export interface PolicyResult {
  state: SlotState;
  commands: readonly Command[];
}

export function initialState(policy: ConcurrencyKind): SlotState {
  if (policy === 'parallel') {
    return { kind: 'parallel', running: [] };
  }
  return { kind: 'idle' };
}

export function step(policy: ConcurrencyKind, state: SlotState, event: PolicyEvent): PolicyResult {
  if (policy === 'parallel') {
    return stepParallel(state, event);
  }
  if (policy === 'restart') {
    return stepRestart(state, event);
  }
  if (policy === 'queue') {
    return stepQueue(state, event);
  }
  return stepIgnore(state, event);
}

function stepParallel(state: SlotState, event: PolicyEvent): PolicyResult {
  if (state.kind !== 'parallel') {
    return { state, commands: [] };
  }
  if (event.kind === 'trigger') {
    return {
      state,
      commands: [{ kind: 'start', reason: event.reason }],
    };
  }
  if (event.kind === 'started') {
    const next: SlotState = { kind: 'parallel', running: [...state.running, event.executionId] };
    return { state: next, commands: [] };
  }
  const filtered = state.running.filter((id) => id !== event.executionId);
  return { state: { kind: 'parallel', running: filtered }, commands: [] };
}

function stepRestart(state: SlotState, event: PolicyEvent): PolicyResult {
  if (event.kind === 'trigger') {
    if (state.kind === 'idle') {
      return { state, commands: [{ kind: 'start', reason: event.reason }] };
    }
    if (state.kind === 'running') {
      return {
        state: {
          kind: 'cancelling_then_start',
          executionId: state.executionId,
          next: event.reason,
        },
        commands: [{ kind: 'cancel', executionId: state.executionId }],
      };
    }
    if (state.kind === 'running_with_queued' || state.kind === 'cancelling_then_start') {
      return {
        state: {
          kind: 'cancelling_then_start',
          executionId: state.executionId,
          next: event.reason,
        },
        commands: [{ kind: 'cancel', executionId: state.executionId }],
      };
    }
    return { state, commands: [] };
  }
  if (event.kind === 'started') {
    if (state.kind === 'idle') {
      return { state: { kind: 'running', executionId: event.executionId }, commands: [] };
    }
    return { state, commands: [] };
  }
  if (state.kind === 'cancelling_then_start' && state.executionId === event.executionId) {
    return {
      state: { kind: 'idle' },
      commands: [{ kind: 'start', reason: state.next }],
    };
  }
  if (state.kind === 'running' && state.executionId === event.executionId) {
    return { state: { kind: 'idle' }, commands: [] };
  }
  return { state, commands: [] };
}

function stepQueue(state: SlotState, event: PolicyEvent): PolicyResult {
  if (event.kind === 'trigger') {
    if (state.kind === 'idle') {
      return { state, commands: [{ kind: 'start', reason: event.reason }] };
    }
    if (state.kind === 'running') {
      return {
        state: { kind: 'running_with_queued', executionId: state.executionId, next: event.reason },
        commands: [],
      };
    }
    if (state.kind === 'running_with_queued') {
      return {
        state: { kind: 'running_with_queued', executionId: state.executionId, next: event.reason },
        commands: [{ kind: 'drop' }],
      };
    }
    return { state, commands: [] };
  }
  if (event.kind === 'started') {
    if (state.kind === 'idle') {
      return { state: { kind: 'running', executionId: event.executionId }, commands: [] };
    }
    return { state, commands: [] };
  }
  if (state.kind === 'running' && state.executionId === event.executionId) {
    return { state: { kind: 'idle' }, commands: [] };
  }
  if (state.kind === 'running_with_queued' && state.executionId === event.executionId) {
    return {
      state: { kind: 'idle' },
      commands: [{ kind: 'start', reason: state.next }],
    };
  }
  return { state, commands: [] };
}

function stepIgnore(state: SlotState, event: PolicyEvent): PolicyResult {
  if (event.kind === 'trigger') {
    if (state.kind === 'idle') {
      return { state, commands: [{ kind: 'start', reason: event.reason }] };
    }
    return { state, commands: [{ kind: 'drop' }] };
  }
  if (event.kind === 'started') {
    if (state.kind === 'idle') {
      return { state: { kind: 'running', executionId: event.executionId }, commands: [] };
    }
    return { state, commands: [] };
  }
  if (state.kind === 'running' && state.executionId === event.executionId) {
    return { state: { kind: 'idle' }, commands: [] };
  }
  return { state, commands: [] };
}
