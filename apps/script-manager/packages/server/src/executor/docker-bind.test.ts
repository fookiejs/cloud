import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dockerBindSource,
  dockerMountLogLine,
  dockerWorkspaceBind,
  needsOneDriveBindHint,
} from './docker-bind.js';

describe('dockerBindSource', () => {
  it('resolves relative paths to absolute', () => {
    const abs = dockerBindSource('.');
    expect(abs).toBe(resolve('.'));
    expect(abs.length).toBeGreaterThan(0);
  });

  it('normalizes trailing segments', () => {
    const abs = dockerBindSource('./nested/../.');
    expect(abs).toBe(resolve('./nested/../.'));
  });
});

describe('dockerWorkspaceBind', () => {
  it('maps host dir to /workspace rw', () => {
    const cwd = dockerBindSource('/tmp/lotaru-proj');
    expect(dockerWorkspaceBind('/tmp/lotaru-proj')).toBe(`${cwd}:/workspace:rw`);
  });
});

describe('dockerMountLogLine', () => {
  it('includes resolved host path', () => {
    const cwd = dockerBindSource('/tmp/lotaru-proj');
    expect(dockerMountLogLine('/tmp/lotaru-proj')).toBe(
      `[lotaru] docker mount ${cwd} -> /workspace`,
    );
  });
});

describe('needsOneDriveBindHint', () => {
  it('detects OneDrive paths case-insensitively', () => {
    expect(needsOneDriveBindHint('C:\\Users\\me\\OneDrive\\proj')).toBe(true);
    expect(needsOneDriveBindHint('/home/me/projects/lotaru')).toBe(false);
  });
});
