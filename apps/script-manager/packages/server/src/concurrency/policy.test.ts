import { describe, it, expect } from 'vitest';
import { initialState, step } from './policy.js';
import type { SlotState, TriggerReason } from './policy.js';

const reason: TriggerReason = { source: 'manual', detail: 'a' };

describe('restart policy', () => {
  it('starts when idle', () => {
    const s = initialState('restart');
    const r = step('restart', s, { kind: 'trigger', reason });
    expect(r.commands).toEqual([{ kind: 'start', reason }]);
    expect(r.state.kind).toBe('idle');
  });

  it('cancels running and starts after end', () => {
    let s: SlotState = { kind: 'running', executionId: 'e1' };
    const triggered = step('restart', s, { kind: 'trigger', reason });
    expect(triggered.commands).toEqual([{ kind: 'cancel', executionId: 'e1' }]);
    expect(triggered.state.kind).toBe('cancelling_then_start');
    s = triggered.state;
    const ended = step('restart', s, { kind: 'ended', executionId: 'e1' });
    expect(ended.commands).toEqual([{ kind: 'start', reason }]);
    expect(ended.state.kind).toBe('idle');
  });
});

describe('queue policy', () => {
  it('queues one and starts on end', () => {
    let s: SlotState = { kind: 'idle' };
    s = step('queue', s, { kind: 'trigger', reason }).state;
    s = step('queue', s, { kind: 'started', executionId: 'e1' }).state;
    const t2 = step('queue', s, { kind: 'trigger', reason: { source: 'save', detail: 'x' } });
    expect(t2.commands).toEqual([]);
    expect(t2.state.kind).toBe('running_with_queued');
    s = t2.state;
    const ended = step('queue', s, { kind: 'ended', executionId: 'e1' });
    expect(ended.commands).toHaveLength(1);
    const first = ended.commands[0];
    if (first === undefined) {
      throw new Error('expected one command');
    }
    expect(first.kind).toBe('start');
  });

  it('drops second queued trigger', () => {
    let s: SlotState = { kind: 'idle' };
    s = step('queue', s, { kind: 'trigger', reason }).state;
    s = step('queue', s, { kind: 'started', executionId: 'e1' }).state;
    s = step('queue', s, { kind: 'trigger', reason }).state;
    const r = step('queue', s, { kind: 'trigger', reason });
    expect(r.commands).toEqual([{ kind: 'drop' }]);
  });
});

describe('ignore policy', () => {
  it('drops triggers while running', () => {
    let s: SlotState = { kind: 'idle' };
    s = step('ignore', s, { kind: 'trigger', reason }).state;
    s = step('ignore', s, { kind: 'started', executionId: 'e1' }).state;
    const r = step('ignore', s, { kind: 'trigger', reason });
    expect(r.commands).toEqual([{ kind: 'drop' }]);
  });
});

describe('parallel policy', () => {
  it('always starts on trigger', () => {
    const s = initialState('parallel');
    const r = step('parallel', s, { kind: 'trigger', reason });
    expect(r.commands).toEqual([{ kind: 'start', reason }]);
  });
  it('tracks list of running ids', () => {
    let s = initialState('parallel');
    s = step('parallel', s, { kind: 'started', executionId: 'a' }).state;
    s = step('parallel', s, { kind: 'started', executionId: 'b' }).state;
    expect(s.kind).toBe('parallel');
    if (s.kind === 'parallel') {
      expect(s.running).toEqual(['a', 'b']);
    }
    s = step('parallel', s, { kind: 'ended', executionId: 'a' }).state;
    if (s.kind === 'parallel') {
      expect(s.running).toEqual(['b']);
    }
  });
});
