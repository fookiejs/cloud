import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tightenFileMode, writeSecretFile } from './secure-file.js';

export const LOCAL_API_TOKEN_FILENAME = 'agent-api-token';

export function localApiTokenPath(dataDir: string): string {
  return join(dataDir, LOCAL_API_TOKEN_FILENAME);
}

export function loadLocalApiToken(dataDir: string): string | null {
  const path = localApiTokenPath(dataDir);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const token = readFileSync(path, 'utf8').trim();
    if (token.length < 32) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function ensureLocalApiToken(dataDir: string): string {
  const fromEnv = process.env['SCRIPT_AGENT_API_TOKEN'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length >= 32) {
    return fromEnv.trim();
  }
  const existing = loadLocalApiToken(dataDir);
  if (existing !== null) {
    tightenFileMode(localApiTokenPath(dataDir));
    return existing;
  }
  mkdirSync(dataDir, { recursive: true });
  const token = randomBytes(32).toString('base64url');
  writeSecretFile(localApiTokenPath(dataDir), `${token}\n`);
  return token;
}

export function localApiTokensEqual(expected: string, got: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function bearerFromAuthorization(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    return null;
  }
  return token;
}

export function bearerFromWsProtocols(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  const protocols = (Array.isArray(raw) ? raw.join(',') : raw)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const bearerIdx = protocols.findIndex((p) => p.toLowerCase() === 'bearer');
  if (bearerIdx >= 0) {
    const next = protocols[bearerIdx + 1];
    if (next !== undefined && next.length > 0) {
      return next;
    }
  }
  return null;
}
