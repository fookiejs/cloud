import Docker from 'dockerode';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDocker } from './docker.js';

async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

const hasDocker = await isDockerAvailable();

interface RunResult {
  lines: string[];
  exitCode: number | null;
}

function runDockerAndWait(opts: {
  command: string;
  cwd: string;
  logPath: string;
  image: string;
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    runDocker({
      command: opts.command,
      cwd: opts.cwd,
      logPath: opts.logPath,
      env: {},
      image: opts.image,
      platform: null,
      onLine: (line) => {
        lines.push(line);
      },
      onExit: (exitCode) => {
        resolve({ lines, exitCode });
      },
    });
  });
}

describe.skipIf(!hasDocker)('runDocker workspace mount', () => {
  it('exposes host project files at /workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lotaru-docker-'));
    const marker = 'lotaru-mount-ok';
    try {
      await writeFile(join(root, 'mount-marker.txt'), marker, 'utf8');
      const logPath = join(root, 'run.log');

      const result = await runDockerAndWait({
        cwd: root,
        logPath,
        image: 'alpine:3.20',
        command: 'pwd && ls -la /workspace && cat /workspace/mount-marker.txt',
      });

      expect(result.exitCode).toBe(0);
      expect(result.lines.some((line) => line.includes(marker))).toBe(true);
      expect(result.lines.some((line) => line.includes('/workspace'))).toBe(true);
      expect(result.lines.some((line) => line.includes('[lotaru] docker mount'))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 180000);
});
