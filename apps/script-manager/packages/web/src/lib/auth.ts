const AUTH = 'https://auth.fookiecloud.com';
const CLIENT_ID = 'lotaru';
const REDIRECT_URI = 'https://lotaru.fookiecloud.com/callback';
const ACCESS_KEY = 'lotaru_access_token';
const REFRESH_KEY = 'lotaru_refresh_token';
const USER_KEY = 'lotaru_user';
const PKCE_VERIFIER_KEY = 'lotaru_pkce_verifier';
const OAUTH_STATE_KEY = 'lotaru_oauth_state';

let exchangeInFlight: Promise<void> | null = null;
let exchangeInFlightCode: string | null = null;

function isCloudHost(): boolean {
  return window.location.hostname === 'lotaru.fookiecloud.com';
}

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

function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function doExchange(code: string, state: string): Promise<void> {
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
        email: user['email'] ?? null,
        name: user['name'] ?? null,
      }),
    );
  }
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}

async function exchangeCode(code: string, state: string): Promise<void> {
  if (exchangeInFlight !== null && exchangeInFlightCode === code) {
    return exchangeInFlight;
  }
  if (getAccessToken() !== null && sessionStorage.getItem(OAUTH_STATE_KEY) === null) {
    return;
  }
  exchangeInFlightCode = code;
  exchangeInFlight = doExchange(code, state).finally(() => {
    exchangeInFlight = null;
    exchangeInFlightCode = null;
  });
  return exchangeInFlight;
}

async function tokenStillValid(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH}/v1/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

type CloudUser = {
  id: string | null;
  email: string | null;
  name: string | null;
};

function getUser(): CloudUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw === null || raw === '') {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let id: string | null = null;
    let email: string | null = null;
    let name: string | null = null;
    if (typeof parsed['id'] === 'string') {
      id = parsed['id'];
    }
    if (typeof parsed['email'] === 'string') {
      email = parsed['email'];
    }
    if (typeof parsed['name'] === 'string') {
      name = parsed['name'];
    }
    return { id, email, name };
  } catch {
    return null;
  }
}

export {
  AUTH,
  isCloudHost,
  signInUrl,
  getAccessToken,
  clearSession,
  exchangeCode,
  tokenStillValid,
  getUser,
};