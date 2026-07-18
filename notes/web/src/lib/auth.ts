const AUTH = "/api/auth";
const CLIENT_ID = "fookie";
const REDIRECT_URI = "";
const ACCESS_KEY = "notes_access_token";
const REFRESH_KEY = "notes_refresh_token";
const USER_KEY = "notes_user";
const PKCE_VERIFIER_KEY = "notes_pkce_verifier";
const OAUTH_STATE_KEY = "notes_oauth_state";

let exchangeInFlight: Promise<void> | null = null;
let exchangeInFlightCode: string | null = null;

function isCloudHost(): boolean {
  return true;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

async function signInUrl(): Promise<string> {
  return `${AUTH}/login?return_to=${encodeURIComponent(import.meta.env.BASE_URL)}`;
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
  void code;
  void state;
  const token = await restoreSessionToken();
  const info = await fetch(`${AUTH}/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
  if (info.ok) {
    const user = (await info.json()) as Record<string, unknown>;
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: user["sub"],
        email: user["email"] ?? null,
        name: user["name"] ?? null,
      }),
    );
  }
}

async function restoreSessionToken(): Promise<string> {
  const response = await fetch(`${AUTH}/session`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("No FookieCloud session");
  const data = (await response.json()) as { access_token?: unknown };
  if (typeof data.access_token !== "string" || data.access_token.length === 0) throw new Error("Invalid FookieCloud session");
  localStorage.setItem(ACCESS_KEY, data.access_token);
  return data.access_token;
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
    const res = await fetch(`${AUTH}/userinfo`, {
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
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      id: typeof parsed.id === "string" ? parsed.id : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: typeof parsed.name === "string" ? parsed.name : null,
    };
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
  restoreSessionToken,
  getUser,
};
