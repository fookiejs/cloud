const AUTH = 'https://auth.fookiecloud.com';
const CLIENT_ID = 'script';
const CLOUD_HOSTS = new Set(['script.fookiecloud.com']);
const REDIRECT_URI =
  typeof window !== 'undefined' && CLOUD_HOSTS.has(window.location.hostname)
    ? `${window.location.origin}/callback`
    : 'https://script.fookiecloud.com/callback';
const GITHUB_URL = 'https://github.com/fookiejs/cloud';
const INSTALL_CMD = 'npx -y @fookiejs/script@latest';
const ACCESS_KEY = 'script_access_token';
const REFRESH_KEY = 'script_refresh_token';
const USER_KEY = 'script_user';
const PKCE_VERIFIER_KEY = 'script_pkce_verifier';
const OAUTH_STATE_KEY = 'script_oauth_state';

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(hash));
}

async function signInUrl(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = await sha256(verifier);
  const state = crypto.randomUUID();
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH}/v1/login?${q.toString()}`;
}

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getUser(): { id: string; email: string | null; name: string | null } | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as {
      id: string;
      email: string | null;
      name: string | null;
    } | null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function exchangeCode(code: string, state: string): Promise<void> {
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (expected === null || state !== expected || verifier === null) {
    throw new Error('invalid oauth state');
  }
  const res = await fetch(`${AUTH}/v1/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error('token exchange failed');
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  localStorage.setItem(ACCESS_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  const info = await fetch(`${AUTH}/v1/userinfo`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (info.ok) {
    const user = (await info.json()) as Record<string, unknown>;
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: user['sub'],
        email: typeof user['email'] === 'string' ? user['email'] : null,
        name: typeof user['name'] === 'string' ? user['name'] : null,
      }),
    );
  }
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}

export {
  AUTH,
  CLIENT_ID,
  REDIRECT_URI,
  GITHUB_URL,
  INSTALL_CMD,
  signInUrl,
  getAccessToken,
  getUser,
  clearSession,
  exchangeCode,
};
