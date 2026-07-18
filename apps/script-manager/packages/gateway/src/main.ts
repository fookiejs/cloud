import type { FastifyInstance } from 'fastify';
import '@fastify/websocket';
import { bearerFromHeader, type GatewayAuth } from './auth.js';
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

export interface ScriptGatewayOptions {
  auth: GatewayAuth;
  publicUrl: string;
  allowedOrigins: ReadonlySet<string>;
  observability: boolean;
}

function tokenFromWsProtocols(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  const protocols = (Array.isArray(raw) ? raw.join(',') : raw)
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

function corsOrigin(reqOrigin: string | undefined, allowedOrigins: ReadonlySet<string>): string | null {
  if (reqOrigin !== undefined && allowedOrigins.has(reqOrigin)) {
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
  auth: GatewayAuth,
): Promise<void> {
  const url = new URL(req.url, 'http://localhost');
  const token = tokenFromRequest(req);
  if (token === null) {
    console.log(JSON.stringify({ msg: 'ws_auth_fail', kind, reason: 'missing_token' }));
    socket.close(4401, 'unauthorized');
    return;
  }
  let user;
  try {
    user = await auth.verifyAccessToken(token);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'verify_failed';
    console.log(JSON.stringify({ msg: 'ws_auth_fail', kind, reason }));
    socket.close(4401, 'unauthorized');
    return;
  }
  if (kind === 'agent') {
    const info = {
      hostname: url.searchParams.get('hostname') || 'unknown',
      version: url.searchParams.get('version') || '0.0.0',
      connectedAt: Date.now(),
    };
    registerAgent(user.id, socket, info);
    console.log(
      JSON.stringify({
        msg: 'agent_registered',
        userId: user.id,
        clientId: user.clientId,
        hostname: info.hostname,
        version: info.version,
      }),
    );
    socket.send(JSON.stringify({ type: 'agent.welcome', userId: user.id }));
    socket.on('message', (data) => {
      handleAgentMessage(user.id, data.toString());
    });
    socket.on('close', (code, reasonBuf) => {
      const reason = Buffer.isBuffer(reasonBuf) ? reasonBuf.toString() : String(reasonBuf);
      console.log(
        JSON.stringify({
          msg: 'agent_ws_close',
          userId: user.id,
          code,
          reason,
        }),
      );
      unregisterAgent(user.id, socket);
    });
    return;
  }
  addConsole(user.id, socket);
  socket.on('close', () => {
    removeConsole(user.id, socket);
  });
}

export async function registerScriptGatewayModule(
  app: FastifyInstance,
  options: ScriptGatewayOptions,
): Promise<void> {
  if (options.observability) {
    await registerObservability(app);
  }

  app.get('/v1/config', async () => ({
    authIssuer: options.auth.issuer,
    clientId: options.auth.clientId,
    redirectUri: `${options.publicUrl}/callback`,
    publicUrl: options.publicUrl,
  }));

  app.options('/api/*', async (req, reply) => {
    const origin = corsOrigin(
      typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      options.allowedOrigins,
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
      options.allowedOrigins,
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
      const user = await options.auth.verifyAccessToken(token);
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
      const user = await options.auth.verifyAccessToken(token);
      return listAgentStatus(user.id);
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/api/v1/stream', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'console', options.auth);
  });

  app.get('/v1/console', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'console', options.auth);
  });

  app.get('/v1/agent', { websocket: true }, (socket, req) => {
    void attachAuthedSocket(socket, req, 'agent', options.auth);
  });

  app.all('/api/v1/*', async (req, reply) => {
    const upgrade = req.headers.upgrade;
    if (typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket') {
      return reply.code(400).send({ error: 'use websocket endpoint' });
    }
    const token = bearerFromHeader(req.headers.authorization);
    if (token === null) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    let user;
    try {
      user = await options.auth.verifyAccessToken(token);
    } catch {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const path = req.raw.url || '/api/v1';
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
        .type(res.headers['content-type'] || 'application/json')
        .send(res.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'proxy failed';
      if (message.includes('offline')) {
        return reply.code(503).send({ error: 'agent_offline', message });
      }
      return reply.code(502).send({ error: 'agent_error', message });
    }
  });

}
