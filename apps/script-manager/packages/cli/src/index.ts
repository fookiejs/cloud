#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PORT = 4317;
const CONSOLE_URL = process.env['LOTARU_CONSOLE_URL'] ?? 'https://lotaru.fookiecloud.com';

interface StartOptions {
  port: number;
  dataDir: string;
  staticDir: string | null;
}

type StartFn = (opts: StartOptions) => Promise<void>;

function resolvePort(): number {
  const envPort = process.env['LOTARU_PORT'];
  if (typeof envPort !== 'string' || envPort.length === 0) {
    return DEFAULT_PORT;
  }
  const n = Number.parseInt(envPort, 10);
  if (Number.isFinite(n) && n > 0) {
    return n;
  }
  return DEFAULT_PORT;
}

function resolveStaticDir(): string | null {
  return null;
}

async function loadStart(): Promise<StartFn> {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = join(here, '..', 'dist-server', 'main.js');
  if (existsSync(bundled)) {
    const mod = (await import(pathToFileURL(bundled).href)) as { start: StartFn };
    return mod.start;
  }
  const mod = await import('@lotaru/server');
  return mod.start;
}

async function main(): Promise<void> {
  const port = resolvePort();
  const dataDir = join(homedir(), '.lotaru');
  const staticDir = resolveStaticDir();
  const start = await loadStart();
  await start({ port, dataDir, staticDir });
  console.log(`\n  → ${CONSOLE_URL}\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
