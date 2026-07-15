import { resolve } from 'node:path';

export function dockerBindSource(hostPath: string): string {
  return resolve(hostPath);
}

export function dockerWorkspaceBind(hostPath: string): string {
  const bindHost = dockerBindSource(hostPath);
  return `${bindHost}:/workspace:rw`;
}

export function dockerMountLogLine(hostPath: string): string {
  const bindHost = dockerBindSource(hostPath);
  return `[lotaru] docker mount ${bindHost} -> /workspace`;
}

export function needsOneDriveBindHint(hostPath: string): boolean {
  return dockerBindSource(hostPath).toLowerCase().includes('onedrive');
}
