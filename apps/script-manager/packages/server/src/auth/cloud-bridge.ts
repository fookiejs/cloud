import WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';
import type { EventBus } from '../events/bus.js';
import { isAllowedBridgeMethod, isAllowedBridgePath } from './bridge-allowlist.js';
import { agentHostname, getValidAccessTokenSilent, loadCredentials } from './credentials.js';

const DEFAULT_GATEWAY = 'https://script.fookiecloud.com';
const PACKAGE_VERSION = process.env['SCRIPT_VERSION'] ?? '0.2.0';
const HEARTBEAT_MS = 20_000;
const PONG_TIMEOUT_MS = 12_000;
const MAX_RETRY_MS = 30_000;

interface BridgeOptions {
  dataDir: string;
  app: FastifyInstance;
  bus: EventBus;
  localApiToken: string;
  gatewayUrl?: string;
}

function toWsBase(httpUrl: string): string {
  const u = new URL(httpUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString().replace(/\/$/, '');
}

export function connectCloudBridge(opts: BridgeOptions): { stop: () => void } {
  const gateway = (opts.gatewayUrl ?? process.env['SCRIPT_GATEWAY_URL'] ?? DEFAULT_GATEWAY).replace(
    /\/$/,
    '',
  );
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryMs = 2000;
  let unsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let connecting = false;

  function clearHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pongTimer !== null) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  }

  function forceCloseSocket(reason: string): void {
    const s = socket;
    if (s === null) {
      return;
    }
    console.log(`  cloud bridge force close (${reason})`);
    try {
      s.terminate();
    } catch {
      void 0;
    }
    socket = null;
  }

  function startHeartbeat(active: WebSocket): void {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (stopped || socket !== active) {
        return;
      }
      if (active.readyState !== WebSocket.OPEN) {
        forceCloseSocket('not open');
        scheduleReconnect();
        return;
      }
      try {
        active.send(JSON.stringify({ type: 'ping', at: Date.now() }));
      } catch {
        forceCloseSocket('ping send failed');
        scheduleReconnect();
        return;
      }
      if (pongTimer !== null) {
        clearTimeout(pongTimer);
      }
      pongTimer = setTimeout(() => {
        if (stopped || socket !== active) {
          return;
        }
        forceCloseSocket('pong timeout');
        scheduleReconnect();
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  function scheduleReconnect(): void {
    if (stopped) {
      return;
    }
    if (retryTimer !== null) {
      return;
    }
    console.log(`  cloud bridge reconnect in ${String(retryMs)}ms`);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  function sendHttpResponse(
    id: string,
    status: number,
    body: string,
    headers: Record<string, string> = { 'content-type': 'application/json' },
  ): void {
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: 'http.response',
        id,
        status,
        headers,
        body,
      }),
    );
  }

  async function handleRequest(msg: Record<string, unknown>): Promise<void> {
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const id = typeof msg['id'] === 'string' ? msg['id'] : null;
    const method = typeof msg['method'] === 'string' ? msg['method'] : 'GET';
    const path = typeof msg['path'] === 'string' ? msg['path'] : '/';
    if (id === null) {
      return;
    }
    if (!isAllowedBridgeMethod(method) || !isAllowedBridgePath(path)) {
      sendHttpResponse(id, 403, JSON.stringify({ error: 'forbidden' }));
      return;
    }
    const headersRaw = msg['headers'];
    const headers: Record<string, string> = {};
    if (typeof headersRaw === 'object' && headersRaw !== null) {
      for (const [k, v] of Object.entries(headersRaw as Record<string, unknown>)) {
        if (typeof v === 'string') {
          const lower = k.toLowerCase();
          if (lower === 'authorization' || lower === 'host' || lower === 'connection') {
            continue;
          }
          headers[k] = v;
        }
      }
    }
    headers['authorization'] = `Bearer ${opts.localApiToken}`;
    const body = typeof msg['body'] === 'string' ? msg['body'] : undefined;
    const hasPayload = body !== undefined && body.length > 0;
    if (!hasPayload) {
      delete headers['content-type'];
      delete headers['Content-Type'];
    }
    try {
      type InjectResult = {
        statusCode: number;
        headers: Record<string, unknown>;
        body: string;
      };
      const inject = opts.app.inject.bind(opts.app) as (opts: {
        method: string;
        url: string;
        headers: Record<string, string>;
        payload?: string;
      }) => Promise<InjectResult>;
      const res = await inject({
        method,
        url: path,
        headers,
        ...(hasPayload ? { payload: body } : {}),
      });
      const outHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === 'string') {
          outHeaders[k] = v;
        } else if (Array.isArray(v) && typeof v[0] === 'string') {
          outHeaders[k] = v[0];
        }
      }
      sendHttpResponse(id, res.statusCode, res.body, outHeaders);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'inject failed';
      sendHttpResponse(id, 500, JSON.stringify({ error: message }));
    }
  }

  async function connect(): Promise<void> {
    if (stopped || connecting) {
      return;
    }
    connecting = true;
    clearHeartbeat();
    try {
      const token = await getValidAccessTokenSilent(opts.dataDir);
      const creds = loadCredentials(opts.dataDir);
      const userLabel = creds?.user.email ?? creds?.user.id ?? 'user';
      const wsUrl = new URL(`${toWsBase(gateway)}/v1/agent`);
      wsUrl.searchParams.set('hostname', agentHostname());
      wsUrl.searchParams.set('version', PACKAGE_VERSION);

      if (socket !== null) {
        try {
          socket.terminate();
        } catch {
          void 0;
        }
        socket = null;
      }

      const active = new WebSocket(wsUrl.toString(), ['bearer', token], {
        headers: { Authorization: `Bearer ${token}` },
      });
      socket = active;

      active.on('open', () => {
        retryMs = 2000;
        console.log(`  cloud bridge connected as ${userLabel} → ${gateway}`);
        startHeartbeat(active);
        if (unsub === null) {
          unsub = opts.bus.subscribe((event) => {
            if (socket !== null && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'event', payload: event }));
            }
          });
        }
      });

      active.on('message', (data) => {
        let msg: unknown;
        try {
          msg = JSON.parse(data.toString()) as unknown;
        } catch {
          return;
        }
        if (typeof msg !== 'object' || msg === null) {
          return;
        }
        const rec = msg as Record<string, unknown>;
        if (rec['type'] === 'pong') {
          if (pongTimer !== null) {
            clearTimeout(pongTimer);
            pongTimer = null;
          }
          return;
        }
        if (rec['type'] === 'http.request') {
          void handleRequest(rec);
        }
      });

      active.on('close', (code, reasonBuf) => {
        if (socket !== active) {
          return;
        }
        socket = null;
        clearHeartbeat();
        if (stopped) {
          return;
        }
        const reason = reasonBuf.toString();
        console.log(
          `  cloud bridge disconnected (${String(code)}${reason.length > 0 ? ` ${reason}` : ''})`,
        );
        scheduleReconnect();
      });

      active.on('error', (err) => {
        console.log(
          `  cloud bridge socket error: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      });
    } catch (err) {
      console.log(
        `  cloud bridge connect failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      scheduleReconnect();
    } finally {
      connecting = false;
    }
  }

  void connect();

  return {
    stop: () => {
      stopped = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      clearHeartbeat();
      if (unsub !== null) {
        unsub();
        unsub = null;
      }
      if (socket !== null) {
        socket.close();
        socket = null;
      }
    },
  };
}
