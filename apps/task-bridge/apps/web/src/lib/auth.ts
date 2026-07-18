const AUTH = "/api/auth";
const CLIENT_ID = "fookie";
const REDIRECT_URI = "";
const ACCESS_KEY = "task_bridge_access_token";
const REFRESH_KEY = "task_bridge_refresh_token";
const OAUTH_STATE_KEY = "task_bridge_oauth_state";

let exchangeInFlight: Promise<string> | null = null;
let exchangeInFlightCode: string | null = null;

export async function signInUrl(): Promise<string> {
  return `${AUTH}/login?return_to=${encodeURIComponent(import.meta.env.BASE_URL)}`;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function clearFookieTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function doExchange(code: string, state: string): Promise<string> {
  void code;
  void state;
  return restoreAccessToken();
}

export async function restoreAccessToken(): Promise<string> {
  const response = await fetch(`${AUTH}/session`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("No FookieCloud session");
  const data = (await response.json()) as { access_token?: unknown };
  if (typeof data.access_token !== "string" || !data.access_token) throw new Error("Invalid FookieCloud session");
  localStorage.setItem(ACCESS_KEY, data.access_token);
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
