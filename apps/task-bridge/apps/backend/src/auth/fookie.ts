import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "../config.js";

const PLATFORM_CLIENT_ID = "fookie";
const TOKEN_USE_API_KEY = "api_key";

const jwks = createRemoteJWKSet(new URL(`${config.fookieAuthIssuer}/.well-known/jwks.json`));

const introspectCache = new Map<string, { active: boolean; expiresAt: number }>();

export type FookieAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  clientId: string;
};

async function introspectApiKey(token: string): Promise<boolean> {
  const cached = introspectCache.get(token);
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.active;
  }
  try {
    const res = await fetch(`${config.fookieAuthIssuer}/v1/introspect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.fookieIntrospectSecret}`,
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      introspectCache.set(token, { active: false, expiresAt: Date.now() + 15_000 });
      return false;
    }
    const data = (await res.json()) as { active?: boolean };
    const active = data.active === true;
    introspectCache.set(token, { active, expiresAt: Date.now() + 60_000 });
    return active;
  } catch {
    introspectCache.set(token, { active: false, expiresAt: Date.now() + 15_000 });
    return false;
  }
}

export async function verifyFookieAccessToken(raw: string): Promise<FookieAuthUser> {
  const { payload } = await jwtVerify(raw, jwks, {
    issuer: config.fookieAuthIssuer,
    algorithms: ["RS256"],
  });
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("missing sub");
  }
  const clientId =
    typeof payload["client_id"] === "string"
      ? payload["client_id"]
      : Array.isArray(payload.aud)
        ? String(payload.aud[0] ?? "")
        : typeof payload.aud === "string"
          ? payload.aud
          : "";
  const tokenUse = typeof payload["token_use"] === "string" ? payload["token_use"] : "";

  if (tokenUse === TOKEN_USE_API_KEY && clientId === PLATFORM_CLIENT_ID) {
    const active = await introspectApiKey(raw);
    if (!active) {
      throw new Error("api key revoked");
    }
  } else if (clientId !== config.taskBridgeClientId) {
    throw new Error("invalid client");
  }

  return {
    id: sub,
    email: typeof payload["email"] === "string" ? payload["email"] : null,
    name: typeof payload["name"] === "string" ? payload["name"] : null,
    clientId,
  };
}
