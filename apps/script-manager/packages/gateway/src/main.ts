import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_ISSUER, CLIENT_ID, bearerFromHeader, verifyAccessToken } from './auth.js';
import {
  addConsole,
  handleAgentMessage,
  listAgentStatus,
  proxyHttp,
  registerAgent,
  removeConsole,
  unregisterAgent,
} from './registry.js';
import { registerObservability } from './observability.js';

const PORT = Number.parseInt(process.env['PORT'] ?? '8080', 10);
const PUBLIC_URL = process.env['PUBLIC_URL'] ?? 'https://lotaru.fookiecloud.com';
const REDIRECT_URI = `${PUBLIC_URL}/callback`;

const ALLOWED_ORIGINS = new Set(
  (process.env['ALLOWED_ORIGINS'] ?? PUBLIC_URL)
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
);

function staticRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'public'),
    join(here, '..', '..', 'web', 'dist'),
    join(here, '..', '..', '..', 'packages', 'web', 'dist'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) {
      return c;
    }
  }
  return null;
}

function tokenFromWsProtocols(raw: string | string[] | undefined): string | null {
  const protocols = (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const bearerIdx = protocols.findIndex((p) => p.toLowerCase() === 'bearer');
  if (bearerIdx >= 0) {
    const next = protocols[bearerIdx + 1];
    if (next !== undefined && next.length > 0) {
      return next;
    }
  }
  return null;
}

function tokenFromRequest(req: {
  headers: {
    authorization?: string | undefined;
    'sec-websocket-protocol'?: string | string[] | undefined;
  };
}): string | null {
  const headerToken = bearerFromHeader(req.headers.authorization);
  if (headerToken !== null) {
    return headerToken;
  }
  return tokenFromWsProtocols(req.headers['sec-websocket-protocol']);
}

function corsOrigin(reqOrigin: string | undefined): string | null {
  if (reqOrigin !== undefined && ALLOWED_ORIGINS.has(reqOrigin)) {
    return reqOrigin;
  }
  return null;
}

async function attachAuthedSocket(
  socket: import('ws').WebSocket,
  req: {
    url: string;
    headers: {
      authorization?: string | undefined;
      'sec-websocket-protocol'?: string | string[] | undefined;
    };
  },
  kind: 'agent' | 'console',
): Promise<void> {
  const url = new URL(req.url, 'http://localhost');
  const token = tokenFromRequest(req);
  if (token === null) {
    socket.close(4401, 'unauthorized');
    return;
  }
  let user;
  try {
    user = await verifyAccessToken(token);
  } catch {
    socket.close(4401, 'unauthorized');
    return;
  }
  if (kind === 'agent') {
    const info = {
      hostname: url.searchParams.get('hostname') ?? 'unknown',
      version: url.searchParams.get('version') ?? '0.0.0',
      connectedAt: Date.now(),
    };
    const session = registerAgent(user.id, socket, info);
    if (session === null) {
      socket.close(4409, 'agent_already_connected');
      return;
    }
    socket.send(JSON.stringify({ type: 'agent.welcome', userId: user.id }));
    socket.on('message', (data) => {
      handleAgentMessage(user.id, data.toString());
    });
    socket.on('close', () => {
      unregisterAgent(user.id, socket);
    });
    return;
  }
  addConsole(user.id, socket);
  socket.on('close', () => {
    removeConsole(user.id, socket);
  });
}

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      serializers: {
        req(req) {
          const rawUrl = typeof req.url === 'string' ? req.url : '';
          return {
            method: req.method,
            url: rawUrl.split('?')[0] ?? '/',
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
    trustProxy: true,
  });
  await registerObservability(app);
  await app.register(fastifyWebsocket);

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/v1/config', async () => ({
    authIssuer: AUTH_ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    publicUrl: PUBLIC_URL,
  }));

  app.options('/api/*', async (req, reply) => {
    const origin = corsOrigin(
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
    );
    if (origin !== null) {
      void reply.header('Access-Control-Allow-Origin', origin);
      void reply.header('Vary', 'Origin');
    }
    void reply
      .header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      .header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
      .code(204)
      .send();
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const origin = corsOrigin(
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
    );
    if (origin !== null) {
      void reply.header('Access-Control-Allow-Origin', origin);
      void reply.header('Vary', 'Origin');
    }
    return payload;
  });

  app.get('/v1/me', async (req, reply) => {
    const token = bearerFromHeader(req.headers.authorization);
    if (token === null) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    try {
      const user = await verifyAccessToken(token);
      return { user, agent: listAgentStatus(user.id) };
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/v1/agent/status', async (req, reply) => {
    const token = bearerFromHeader(req.headers.authorization);
    if (token === null) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    try {
      const user = await verifyAccessToken(token);
      return listAgentStatus(user.id);
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/api/v1/stream', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'console');
  });

  app.get('/v1/console', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'console');
  });

  app.get('/v1/agent', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'agent');
  });

  app.all('/api/v1/*', async (req, reply) => {
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      return reply.code(400).send({ error: 'use websocket endpoint' });
    }
    const token = bearerFromHeader(req.headers.authorization);
    if (token === null) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    let user;
    try {
      user = await verifyAccessToken(token);
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const path = req.raw.url ?? '/api/v1';
    let body: string | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    const headers: Record<string, string> = {};
    const contentType = req.headers['content-type'];
    if (typeof contentType === 'string' && contentType.length > 0) {
      headers['content-type'] = contentType;
    } else if (body !== null && body.length > 0) {
      headers['content-type'] = 'application/json';
    }
    try {
      const res = await proxyHttp(user.id, req.method, path, headers, body);
      for (const [k, v] of Object.entries(res.headers)) {
        if (k.toLowerCase() === 'transfer-encoding') {
          continue;
        }
        void reply.header(k, v);
      }
      return reply
        .code(res.status)
        .type(res.headers['content-type'] ?? 'application/json')
        .send(res.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proxy failed';
      if (message.includes('offline')) {
        return reply.code(503).send({ error: 'agent_offline', message });
      }
      return reply.code(502).send({ error: 'agent_error', message });
    }
  });

  const root = staticRoot();
  if (root !== null) {
    await app.register(fastifyStatic, { root, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/v1/')) {
        void reply.code(404).send({ error: 'not found' });
        return;
      }
      void reply.sendFile('index.html');
    });
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
