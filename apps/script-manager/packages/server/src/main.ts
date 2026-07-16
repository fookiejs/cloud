import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openStore } from './db/index.js';
import { createBus } from './events/bus.js';
import { createWatcherManager } from './watcher/index.js';
import { createScheduler } from './scheduler/index.js';
import { createOrchestrator } from './orchestrator.js';
import { createHub } from './ws/hub.js';
import { registerRoutes } from './http/routes.js';
import { ensureAuth } from './auth/credentials.js';
import { connectCloudBridge } from './auth/cloud-bridge.js';
import { registerLocalApiAuth } from './auth/local-auth.js';
import { ensureLocalApiToken } from './auth/local-token.js';

const DEFAULT_PORT = 4317;
const CONSOLE_URL = process.env['SCRIPT_CONSOLE_URL'] ?? 'https://script.fookiecloud.com';

interface StartOptions {
  port: number;
  dataDir: string;
  staticDir: string | null;
}

export async function start(opts: StartOptions): Promise<void> {
  mkdirSync(opts.dataDir, { recursive: true });
  const dbPath = join(opts.dataDir, 'script.db');
  const logsDir = join(opts.dataDir, 'logs');
  mkdirSync(logsDir, { recursive: true });

  console.log('\n  Sign in with Fookie to connect this machine as your Script backend…\n');
  const creds = await ensureAuth(opts.dataDir);
  console.log(`  signed in as ${creds.user.email ?? creds.user.id}`);

  const store = openStore(dbPath);
  const bus = createBus();
  const scheduler = createScheduler();

  const orchRef: { current: ReturnType<typeof createOrchestrator> | null } = { current: null };
  const watchers = createWatcherManager((e) => {
    const cur = orchRef.current;
    if (cur === null) {
      return;
    }
    cur.handleWatchEvent(e);
  });

  const orch = createOrchestrator(store, bus, watchers, scheduler, logsDir);
  orchRef.current = orch;
  orch.loadAll();

  const localApiToken = ensureLocalApiToken(opts.dataDir);

  const app = Fastify({ logger: { level: 'info' } });

  await app.register(fastifyWebsocket);
  registerLocalApiAuth(app, localApiToken);

  registerRoutes(app, store, bus, orch);

  const hub = createHub(bus, orch);
  app.get('/api/v1/stream', { websocket: true }, (socket) => {
    hub.attach(socket);
  });

  app.get('/', async (_req, reply) => {
    return reply.redirect(CONSOLE_URL);
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      void reply.code(404).send({ error: 'not found' });
      return;
    }
    void reply.redirect(CONSOLE_URL);
  });

  let bridgeStop: (() => void) | null = null;

  const shutdown = async (): Promise<void> => {
    app.log.info('shutting down');
    if (bridgeStop !== null) {
      bridgeStop();
    }
    await orch.shutdown();
    store.close();
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown().then(() => {
      process.exit(0);
    });
  });
  process.on('SIGTERM', () => {
    void shutdown().then(() => {
      process.exit(0);
    });
  });

  await app.listen({ port: opts.port, host: '127.0.0.1' });

  const bridge = connectCloudBridge({
    dataDir: opts.dataDir,
    app,
    bus,
    localApiToken,
  });
  bridgeStop = bridge.stop;
  console.log(`\n  agent listening on 127.0.0.1:${String(opts.port)}`);
  console.log(`  open console → ${CONSOLE_URL}\n`);
}

function isMainEntry(): boolean {
  const argvPath = process.argv[1];
  if (argvPath === undefined) {
    return false;
  }
  const url = import.meta.url.toLowerCase();
  const normalised = argvPath.replace(/\\/g, '/').toLowerCase();
  if (url.endsWith(normalised)) {
    return true;
  }
  if (url.endsWith(normalised.replace(/\.ts$/, '.js'))) {
    return true;
  }
  return false;
}

if (isMainEntry()) {
  let port = DEFAULT_PORT;
  const envPort = process.env['SCRIPT_PORT'];
  if (typeof envPort === 'string' && envPort.length > 0) {
    const n = Number.parseInt(envPort, 10);
    if (Number.isFinite(n) && n > 0) {
      port = n;
    }
  }
  const dataDir = join(homedir(), '.script');
  void start({
    port,
    dataDir,
    staticDir: null,
  }).catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
