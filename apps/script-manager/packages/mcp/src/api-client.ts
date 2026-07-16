import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export class ScriptApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ScriptApiError';
    this.status = status;
    this.body = body;
  }
}

function trimTrailingSlash(value: string): string {
  if (value.endsWith('/')) {
    return value.slice(0, -1);
  }
  return value;
}

export function resolveBaseUrl(): string {
  const fromEnv = process.env['SCRIPT_API_URL'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return trimTrailingSlash(fromEnv.trim());
  }
  return 'http://127.0.0.1:4317';
}

function loadCredentialsToken(): string {
  const path = join(homedir(), '.script', 'credentials.json');
  if (!existsSync(path)) {
    return '';
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { access_token?: string };
    if (typeof raw.access_token === 'string' && raw.access_token.length > 0) {
      return raw.access_token;
    }
  } catch {
    return '';
  }
  return '';
}

function loadLocalAgentApiToken(): string {
  const fromEnv = process.env['SCRIPT_AGENT_API_TOKEN'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  const path = join(homedir(), '.script', 'agent-api-token');
  if (!existsSync(path)) {
    return '';
  }
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
}

function isLocalBaseUrl(baseUrl: string): boolean {
  return baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
}

export function resolveToken(baseUrl: string): string {
  const apiKey = process.env['FOOKIE_API_KEY'];
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return apiKey.trim();
  }
  const token = process.env['SCRIPT_TOKEN'];
  if (typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  if (isLocalBaseUrl(baseUrl)) {
    return loadLocalAgentApiToken();
  }
  return loadCredentialsToken();
}

function buildQuery(params: Record<string, string | number | boolean | null>): string {
  const search = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === null) {
      continue;
    }
    search.set(key, String(value));
  }
  const text = search.toString();
  if (text.length === 0) {
    return '';
  }
  return `?${text}`;
}

export class ScriptApi {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.token = token.trim();
  }

  static fromEnv(): ScriptApi {
    const baseUrl = resolveBaseUrl();
    return new ScriptApi(baseUrl, resolveToken(baseUrl));
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      query?: Record<string, string | number | boolean | null> | null;
      body?: object | null;
    },
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (options !== undefined && options.query !== undefined && options.query !== null) {
      url = `${url}${buildQuery(options.query)}`;
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (this.token.length > 0) {
      headers['authorization'] = `Bearer ${this.token}`;
    }
    let body: string | undefined;
    if (options !== undefined && options.body !== undefined && options.body !== null) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = body;
    }
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      throw new ScriptApiError(text || res.statusText, res.status, text);
    }
    if (text.length === 0) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | null>): Promise<T> {
    return this.request<T>('GET', path, { query: query || null });
  }

  post<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('POST', path, { body: body || null });
  }

  patch<T>(path: string, body?: object): Promise<T> {
    return this.request<T>('PATCH', path, { body: body || null });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
