const AUTH = "https://auth.fookiecloud.com";
const CLIENT_ID = "task-bridge";
const REDIRECT_URI =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? `${window.location.origin}/app/callback`
    : "https://task-bridge.fookiecloud.com/app/callback";
const ACCESS_KEY = "task_bridge_access_token";
const REFRESH_KEY = "task_bridge_refresh_token";
const PKCE_VERIFIER_KEY = "task_bridge_pkce_verifier";
const OAUTH_STATE_KEY = "task_bridge_oauth_state";

let exchangeInFlight: Promise<string> | null = null;
let exchangeInFlightCode: string | null = null;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

export async function signInUrl(): Promise<string> {
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
    code_challenge_method: "S256",
  });
  return `${AUTH}/v1/login?${q.toString()}`;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function clearFookieTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function doExchange(code: string, state: string): Promise<string> {
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (expected === null || state !== expected || verifier === null) {
    throw new Error("invalid oauth state");
  }
  const res = await fetch(`${AUTH}/v1/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error("token exchange failed");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  localStorage.setItem(ACCESS_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return data.access_token;
}

export async function exchangeCode(code: string, state: string): Promise<string> {
  if (exchangeInFlight !== null && exchangeInFlightCode === code) {
    return exchangeInFlight;
  }
  const existing = getAccessToken();
  if (existing !== null && sessionStorage.getItem(OAUTH_STATE_KEY) === null) {
    return existing;
  }
  exchangeInFlightCode = code;
  exchangeInFlight = doExchange(code, state).finally(() => {
    exchangeInFlight = null;
    exchangeInFlightCode = null;
  });
  return exchangeInFlight;
}

export { AUTH, CLIENT_ID, REDIRECT_URI };
