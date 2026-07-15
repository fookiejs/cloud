import { chmodSync, writeFileSync } from 'node:fs';

export function writeSecretFile(path: string, contents: string): void {
  writeFileSync(path, contents, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    void 0;
  }
}

export function tightenFileMode(path: string): void {
  try {
    chmodSync(path, 0o600);
  } catch {
    void 0;
  }
}
