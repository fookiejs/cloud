import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTH_ISSUER = process.env['FOOKIE_AUTH_ISSUER'];
if (AUTH_ISSUER === undefined || AUTH_ISSUER.length === 0) {
  throw new Error('FOOKIE_AUTH_ISSUER required');
}
const CLIENT_ID = process.env['SCRIPT_CLIENT_ID'];
if (CLIENT_ID === undefined || CLIENT_ID.length === 0) {
  throw new Error('SCRIPT_CLIENT_ID required');
}
const INTROSPECT_SECRET = process.env['FOOKIE_INTROSPECT_SECRET'];
if (INTROSPECT_SECRET === undefined || INTROSPECT_SECRET.length === 0) {
  throw new Error('FOOKIE_INTROSPECT_SECRET required');
}
const ALLOWED_CLIENT_IDS = new Set([CLIENT_ID]);
const PLATFORM_CLIENT_ID = 'fookie';
const TOKEN_USE_API_KEY = 'api_key';
const JWKS_URL = new URL(`${AUTH_ISSUER}/.well-known/jwks.json`);

const jwks = createRemoteJWKSet(JWKS_URL);

const introspectCache = new Map<string, { active: boolean; expiresAt: number }>();

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  clientId: string;
}

async function introspectApiKey(token: string): Promise<boolean> {
  const cached = introspectCache.get(token);
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.active;
  }
  try {
    const res = await fetch(`${AUTH_ISSUER}/v1/introspect`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${INTROSPECT_SECRET}`,
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

export async function verifyAccessToken(raw: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(raw, jwks, {
    issuer: AUTH_ISSUER,
    algorithms: ['RS256'],
  });
  const sub = payload.sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('missing sub');
  }
  const clientIdRaw = payload['client_id'];
  const aud = payload.aud;
  const clientId =
    typeof clientIdRaw === 'string'
      ? clientIdRaw
      : typeof aud === 'string'
        ? aud
        : Array.isArray(aud) && typeof aud[0] === 'string'
          ? aud[0]
          : undefined;
  if (clientId === undefined) {
    throw new Error('invalid client');
  }
  const tokenUse =
    typeof payload['token_use'] === 'string' ? payload['token_use'] : undefined;

  if (tokenUse === TOKEN_USE_API_KEY && clientId === PLATFORM_CLIENT_ID) {
    const active = await introspectApiKey(raw);
    if (!active) {
      throw new Error('api key revoked');
    }
  } else if (!ALLOWED_CLIENT_IDS.has(clientId)) {
    throw new Error('invalid client');
  }

  return {
    id: sub,
    email: typeof payload['email'] === 'string' ? payload['email'] : null,
    name: typeof payload['name'] === 'string' ? payload['name'] : null,
    clientId,
  };
}

export function bearerFromHeader(header: string | string[] | undefined): string | null {
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

export { AUTH_ISSUER, CLIENT_ID };
