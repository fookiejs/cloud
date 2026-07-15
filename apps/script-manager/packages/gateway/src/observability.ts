import { bearerFromHeader } from './auth.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

const SERVICE = 'lotaru';

const register = new Registry();
collectDefaultMetrics({ register, prefix: 'lotaru_' });

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['service', 'method', 'route', 'status_class'] as const,
  registers: [register],
});

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['service', 'method', 'route', 'status_class'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'In-flight HTTP requests',
  labelNames: ['service'] as const,
  registers: [register],
});

function statusClass(code: number): string {
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  if (code >= 200) return '2xx';
  return '1xx';
}

function normalizeRoute(url: string): string {
  const path = url.split('?')[0] ?? '/';
  return path
    .split('/')
    .map((p) => {
      if (p.length === 0) return p;
      if (/^[0-9a-f-]{8,}$/i.test(p) || /^\d+$/.test(p)) return ':id';
      return p;
    })
    .join('/');
}

function clientIp(req: FastifyRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim() ?? req.ip;
  }
  if (Array.isArray(xf) && xf[0]) {
    return xf[0].split(',')[0]?.trim() ?? req.ip;
  }
  return req.ip;
}

export async function registerObservability(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (req, reply) => {
    const expected = process.env['METRICS_TOKEN'];
    if (expected === undefined || expected.length === 0) {
      return reply.code(404).send();
    }
    const got = bearerFromHeader(req.headers.authorization);
    if (got !== expected) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });

  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/metrics') || req.url.startsWith('/healthz')) {
      return;
    }
    httpInFlight.inc({ service: SERVICE });
    (req as FastifyRequest & { __obsStart?: bigint }).__obsStart = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/metrics') || req.url.startsWith('/healthz')) {
      return;
    }
    httpInFlight.dec({ service: SERVICE });
    const start = (req as FastifyRequest & { __obsStart?: bigint }).__obsStart;
    const durMs =
      start === undefined ? 0 : Number(process.hrtime.bigint() - start) / 1e6;
    const route = normalizeRoute(req.url);
    const sc = statusClass(reply.statusCode);
    httpRequests.inc({ service: SERVICE, method: req.method, route, status_class: sc });
    httpDuration.observe(
      { service: SERVICE, method: req.method, route, status_class: sc },
      durMs / 1000,
    );
    const line = {
      msg: 'http_access',
      service: SERVICE,
      client_ip: clientIp(req),
      method: req.method,
      path: req.url.split('?')[0] ?? '/',
      status: reply.statusCode,
      duration_ms: Math.round(durMs * 100) / 100,
      request_id: req.id,
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  });
}
