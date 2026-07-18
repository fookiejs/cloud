import { createRemoteJWKSet, jwtVerify } from 'jose';

const PLATFORM_CLIENT_ID = 'fookie';
const TOKEN_USE_API_KEY = 'api_key';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  clientId: string;
}

export interface GatewayAuth {
  issuer: string;
  clientId: string;
  verifyAccessToken(raw: string): Promise<AuthUser>;
}

export function createGatewayAuth(options: {
  issuer: string;
  clientId: string;
  introspectSecret: string;
}): GatewayAuth {
  const issuer = options.issuer.replace(/\/$/, '');
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const allowedClientIds = new Set([options.clientId, 'script', 'lotaru']);
  const introspectCache = new Map<string, { active: boolean; expiresAt: number }>();
  async function introspectApiKey(token: string): Promise<boolean> {
    const cached = introspectCache.get(token);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.active;
    }
    try {
      const response = await fetch(`${issuer}/v1/introspect`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.introspectSecret}`,
        },
        body: JSON.stringify({ token }),
      });
      const active = response.ok && ((await response.json()) as { active?: boolean }).active === true;
      introspectCache.set(token, { active, expiresAt: Date.now() + (active ? 60_000 : 15_000) });
      return active;
    } catch {
      introspectCache.set(token, { active: false, expiresAt: Date.now() + 15_000 });
      return false;
    }
  }
  return {
    issuer,
    clientId: options.clientId,
    async verifyAccessToken(raw: string): Promise<AuthUser> {
      const { payload } = await jwtVerify(raw, jwks, {
        issuer,
        algorithms: ['RS256'],
      });
      const sub = payload.sub;
      if (typeof sub !== 'string' || sub.length === 0) {
        throw new Error('missing sub');
      }
      const clientIdRaw = payload['client_id'];
      const audience = payload.aud;
      const clientId =
        typeof clientIdRaw === 'string'
          ? clientIdRaw
          : typeof audience === 'string'
            ? audience
            : Array.isArray(audience) && typeof audience[0] === 'string'
              ? audience[0]
              : '';
      if (clientId.length === 0) {
        throw new Error('invalid client');
      }
      const tokenUse = typeof payload['token_use'] === 'string' ? payload['token_use'] : '';
      if (tokenUse === TOKEN_USE_API_KEY && clientId === PLATFORM_CLIENT_ID) {
        if (options.introspectSecret.length === 0 || !(await introspectApiKey(raw))) {
          throw new Error('api key revoked');
        }
      } else if (!allowedClientIds.has(clientId)) {
        throw new Error('invalid client');
      }
      return {
        id: sub,
        email: typeof payload['email'] === 'string' ? payload['email'] : null,
        name: typeof payload['name'] === 'string' ? payload['name'] : null,
        clientId,
      };
    },
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
