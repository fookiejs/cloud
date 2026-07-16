import type { FastifyInstance } from 'fastify';
import {
  bearerFromAuthorization,
  bearerFromWsProtocols,
  localApiTokensEqual,
} from './local-token.js';

function requestPath(url: string): string {
  return url.split('?')[0] || '/';
}

export function registerLocalApiAuth(app: FastifyInstance, localApiToken: string): void {
  app.addHook('onRequest', async (req, reply) => {
    const path = requestPath(req.url);
    if (!path.startsWith('/api/')) {
      return;
    }
    let got = bearerFromAuthorization(req.headers.authorization);
    if (got === null) {
      got = bearerFromWsProtocols(req.headers['sec-websocket-protocol']);
    }
    if (got === null || !localApiTokensEqual(localApiToken, got)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
}
