import { describe, expect, it } from 'vitest';
import { isAllowedBridgeMethod, isAllowedBridgePath } from './bridge-allowlist.js';

describe('bridge allowlist', () => {
  it('allows api v1 paths', () => {
    expect(isAllowedBridgePath('/api/v1/workspaces')).toBe(true);
    expect(isAllowedBridgePath('/api/v1/tasks/abc/run?x=1')).toBe(true);
    expect(isAllowedBridgePath('/api/v1')).toBe(true);
  });

  it('rejects traversal and non-api paths', () => {
    expect(isAllowedBridgePath('/')).toBe(false);
    expect(isAllowedBridgePath('/healthz')).toBe(false);
    expect(isAllowedBridgePath('/api/v1/../secret')).toBe(false);
    expect(isAllowedBridgePath('/api/v2/workspaces')).toBe(false);
  });

  it('allows safe methods only', () => {
    expect(isAllowedBridgeMethod('GET')).toBe(true);
    expect(isAllowedBridgeMethod('post')).toBe(true);
    expect(isAllowedBridgeMethod('PUT')).toBe(false);
    expect(isAllowedBridgeMethod('TRACE')).toBe(false);
  });
});
