export const FOOKIE_AUTH_ISSUER = "https://auth.fookiecloud.com";
export const FOOKIE_CLOUD_URL = "https://fookiecloud.com";
export const FOOKIE_PROFILE_URL = "https://fookiecloud.com/profile";

export type FookieCloudUser = {
  id: string | null;
  email: string | null;
  name: string | null;
};

export type FookieOAuthClientConfig = {
  clientId: string;
  redirectUri: string;
  accessKey: string;
  refreshKey: string;
  userKey: string;
  pkceVerifierKey: string;
  oauthStateKey: string;
  cloudHostname: string;
};

export const SCRIPT_MANAGER_OAUTH: FookieOAuthClientConfig = {
  clientId: "lotaru",
  redirectUri: "https://lotaru.fookiecloud.com/callback",
  accessKey: "lotaru_access_token",
  refreshKey: "lotaru_refresh_token",
  userKey: "lotaru_user",
  pkceVerifierKey: "lotaru_pkce_verifier",
  oauthStateKey: "lotaru_oauth_state",
  cloudHostname: "lotaru.fookiecloud.com",
};

export const TASK_BRIDGE_OAUTH: FookieOAuthClientConfig = {
  clientId: "task-bridge",
  redirectUri: "https://task-bridge.fookiecloud.com/app/callback",
  accessKey: "task_bridge_access_token",
  refreshKey: "task_bridge_refresh_token",
  userKey: "task_bridge_user",
  pkceVerifierKey: "task_bridge_pkce_verifier",
  oauthStateKey: "task_bridge_oauth_state",
  cloudHostname: "task-bridge.fookiecloud.com",
};

export const NOTES_OAUTH: FookieOAuthClientConfig = {
  clientId: "notes",
  redirectUri: "https://notes.fookiecloud.com/callback",
  accessKey: "notes_access_token",
  refreshKey: "notes_refresh_token",
  userKey: "notes_user",
  pkceVerifierKey: "notes_pkce_verifier",
  oauthStateKey: "notes_oauth_state",
  cloudHostname: "notes.fookiecloud.com",
};

export const APP_DISPLAY_NAMES = {
  scriptManager: "Script Manager",
  taskBridge: "Task Bridge",
  notes: "Notes",
  auth: "Auth",
} as const;
