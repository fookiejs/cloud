import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname as osHostname } from 'node:os';
import { tightenFileMode, writeSecretFile } from './secure-file.js';

const authIssuerEnv = process.env['FOOKIE_AUTH_ISSUER'];
const AUTH_ISSUER =
  authIssuerEnv !== undefined && authIssuerEnv.length > 0
    ? authIssuerEnv
    : 'https://auth.fookiecloud.com';
const CLIENT_ID = 'script';
const AGENT_REDIRECT_URI =
  process.env['SCRIPT_AGENT_REDIRECT_URI'] || 'http://127.0.0.1:8743/callback';
const AGENT_CALLBACK_PORT = Number.parseInt(
  process.env['SCRIPT_AGENT_CALLBACK_PORT'] || '8743',
  10,
);

export interface Credentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
}

function credentialsPath(dataDir: string): string {
  return join(dataDir, 'credentials.json');
}

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function loadCredentials(dataDir: string): Credentials | null {
  const path = credentialsPath(dataDir);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Credentials;
    if (typeof raw.access_token !== 'string' || typeof raw.refresh_token !== 'string') {
      return null;
    }
    tightenFileMode(path);
    return raw;
  } catch {
    return null;
  }
}

export function saveCredentials(dataDir: string, creds: Credentials): void {
  mkdirSync(dataDir, { recursive: true });
  writeSecretFile(credentialsPath(dataDir), `${JSON.stringify(creds, null, 2)}\n`);
}

async function exchangeToken(body: Record<string, string>): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTH_ISSUER}/v1/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token exchange failed: ${String(res.status)} ${text}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

async function fetchUserInfo(accessToken: string): Promise<{
  id: string;
  email: string | null;
  name: string | null;
}> {
  const res = await fetch(`${AUTH_ISSUER}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('userinfo failed');
  }
  const data = (await res.json()) as Record<string, unknown>;
  const id = typeof data['sub'] === 'string' ? data['sub'] : '';
  if (id.length === 0) {
    throw new Error('userinfo missing sub');
  }
  return {
    id,
    email: typeof data['email'] === 'string' ? data['email'] : null,
    name: typeof data['name'] === 'string' ? data['name'] : null,
  };
}

async function refreshCredentials(dataDir: string, creds: Credentials): Promise<Credentials> {
  const tokens = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: CLIENT_ID,
  });
  const user = await fetchUserInfo(tokens.access_token);
  const next: Credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || creds.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    user,
  };
  saveCredentials(dataDir, next);
  return next;
}

function interactiveLogin(dataDir: string): Promise<Credentials> {
  const { verifier, challenge } = pkcePair();
  const state = base64url(randomBytes(16));
  const loginUrl = new URL(`${AUTH_ISSUER}/v1/login`);
  loginUrl.searchParams.set('client_id', CLIENT_ID);
  loginUrl.searchParams.set('redirect_uri', AGENT_REDIRECT_URI);
  loginUrl.searchParams.set('state', state);
  loginUrl.searchParams.set('code_challenge', challenge);
  loginUrl.searchParams.set('code_challenge_method', 'S256');

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void (async () => {
        try {
          const url = new URL(req.url || '/', `http://127.0.0.1:${String(AGENT_CALLBACK_PORT)}`);
          if (url.pathname !== '/callback') {
            res.writeHead(404);
            res.end('not found');
            return;
          }
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          if (code === null || returnedState !== state) {
            res.writeHead(400);
            res.end('invalid callback');
            return;
          }
          const tokens = await exchangeToken({
            grant_type: 'authorization_code',
            code,
            client_id: CLIENT_ID,
            redirect_uri: AGENT_REDIRECT_URI,
            code_verifier: verifier,
          });
          const user = await fetchUserInfo(tokens.access_token);
          const creds: Credentials = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + tokens.expires_in * 1000,
            user,
          };
          saveCredentials(dataDir, creds);
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(
            `<!doctype html><html><head><title>Script Manager</title></head><body style="font-family:system-ui;padding:2rem;background:#0c0c0f;color:#eee"><h1>Signed in</h1><p>You can close this window.</p></body></html>`,
          );
          server.close();
          resolve(creds);
        } catch (err) {
          res.writeHead(500);
          res.end('login failed');
          server.close();
          reject(err);
        }
      })();
    });
    server.listen(AGENT_CALLBACK_PORT, '127.0.0.1', () => {
      console.log(`\n  Sign in with Fookie to continue…`);
      console.log(`  ${loginUrl.toString()}\n`);
    });
    server.on('error', reject);
  });
}

export async function ensureAuth(dataDir: string): Promise<Credentials> {
  const existing = loadCredentials(dataDir);
  if (existing !== null) {
    if (existing.expires_at > Date.now() + 60_000) {
      return existing;
    }
    try {
      return await refreshCredentials(dataDir, existing);
    } catch {}
  }
  return await interactiveLogin(dataDir);
}

export async function getValidAccessToken(dataDir: string): Promise<string> {
  const creds = await ensureAuth(dataDir);
  if (creds.expires_at > Date.now() + 60_000) {
    return creds.access_token;
  }
  const refreshed = await refreshCredentials(dataDir, creds);
  return refreshed.access_token;
}

export async function getValidAccessTokenSilent(dataDir: string): Promise<string> {
  const existing = loadCredentials(dataDir);
  if (existing === null) {
    throw new Error('no credentials');
  }
  if (existing.expires_at > Date.now() + 60_000) {
    return existing.access_token;
  }
  const refreshed = await refreshCredentials(dataDir, existing);
  return refreshed.access_token;
}

export function agentHostname(): string {
  return osHostname();
}

export { AUTH_ISSUER, CLIENT_ID, AGENT_REDIRECT_URI };
