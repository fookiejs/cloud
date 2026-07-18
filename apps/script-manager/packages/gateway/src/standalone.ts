import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGatewayAuth } from './auth.js';
import { registerScriptGatewayModule } from './main.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} required`);
  }
  return value;
}

function staticRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'public'),
    join(here, '..', '..', 'web', 'dist'),
    join(here, '..', '..', '..', 'packages', 'web', 'dist'),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env['PORT'] || '8080', 10);
  const publicUrl = process.env['PUBLIC_URL'] || 'https://script.fookiecloud.com';
  const allowedOrigins = new Set(
    (process.env['ALLOWED_ORIGINS'] || publicUrl)
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
  const auth = createGatewayAuth({
    issuer: requireEnv('FOOKIE_AUTH_ISSUER'),
    clientId: requireEnv('SCRIPT_CLIENT_ID'),
    introspectSecret: requireEnv('FOOKIE_INTROSPECT_SECRET'),
  });
  const app = Fastify({ logger: true, trustProxy: true });
  await app.register(fastifyWebsocket);
  app.get('/healthz', async () => ({ ok: true }));
  await registerScriptGatewayModule(app, {
    auth,
    publicUrl,
    allowedOrigins,
    observability: true,
  });
  const root = staticRoot();
  if (root !== null) {
    await app.register(fastifyStatic, { root, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/v1/')) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  }
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
