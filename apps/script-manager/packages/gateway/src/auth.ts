import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTH_ISSUER = process.env['FOOKIE_AUTH_ISSUER'] ?? 'https://auth.fookiecloud.com';
const CLIENT_ID = process.env['LOTARU_CLIENT_ID'] ?? 'lotaru';
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
        authorization: `Bearer ${process.env['FOOKIE_INTROSPECT_SECRET'] ?? ''}`,
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
  const clientId =
    typeof payload['client_id'] === 'string'
      ? payload['client_id']
      : Array.isArray(payload.aud)
        ? String(payload.aud[0] ?? '')
        : typeof payload.aud === 'string'
          ? payload.aud
          : '';
  const tokenUse = typeof payload['token_use'] === 'string' ? payload['token_use'] : '';

  if (tokenUse === TOKEN_USE_API_KEY && clientId === PLATFORM_CLIENT_ID) {
    const active = await introspectApiKey(raw);
    if (!active) {
      throw new Error('api key revoked');
    }
  } else if (clientId !== CLIENT_ID) {
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
