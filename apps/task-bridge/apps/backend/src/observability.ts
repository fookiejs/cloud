import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

const SERVICE = "task-bridge";

type Labels = {
  service: string;
  method: string;
  route: string;
  status_class: string;
};

type ObsRequest = FastifyRequest & {
  __obsStart: bigint | null;
};

const requestCounts = new Map<string, number>();
const durationSums = new Map<string, number>();
const durationCounts = new Map<string, number>();
let inFlight = 0;

function keyOf(l: Labels): string {
  return `${l.service}|${l.method}|${l.route}|${l.status_class}`;
}

function statusClass(code: number): string {
  if (code >= 500) return "5xx";
  if (code >= 400) return "4xx";
  if (code >= 300) return "3xx";
  if (code >= 200) return "2xx";
  return "1xx";
}

function normalizeRoute(url: string): string {
  const q = url.indexOf("?");
  let path = url;
  if (q >= 0) {
    path = url.slice(0, q);
  }
  if (path.length === 0) {
    path = "/";
  }
  const parts = path.split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p.length === 0) {
      out.push(p);
      continue;
    }
    if (/^[0-9a-f-]{8,}$/i.test(p) || /^\d+$/.test(p)) {
      out.push(":id");
      continue;
    }
    out.push(p);
  }
  return out.join("/");
}

const sensitiveQueryKeys = new Set([
  "token",
  "access_token",
  "refresh_token",
  "code",
  "key",
  "secret",
  "password",
  "authorization",
  "api_key",
  "client_secret",
]);

function sanitizeQuery(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) {
    return "";
  }
  const raw = url.slice(q + 1);
  if (raw.length === 0) {
    return "";
  }
  const params = new URLSearchParams(raw);
  const out = new URLSearchParams();
  for (const key of params.keys()) {
    const value = params.get(key);
    if (value === null) {
      continue;
    }
    if (sensitiveQueryKeys.has(key.toLowerCase())) {
      out.set(key, "[redacted]");
      continue;
    }
    if (value.length > 120) {
      out.set(key, `${value.slice(0, 40)}…`);
      continue;
    }
    out.set(key, value);
  }
  const text = out.toString();
  if (text.length > 500) {
    return `${text.slice(0, 500)}…`;
  }
  return text;
}

function firstForwarded(raw: string): string | null {
  const chunks = raw.split(",");
  if (chunks.length === 0) {
    return null;
  }
  const part = chunks[0] as string;
  const trimmed = part.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function clientIp(req: FastifyRequest): string {
  const xf = req.headers["x-forwarded-for"];
  if (Array.isArray(xf) && xf.length > 0) {
    const first = xf[0] as string;
    const parsed = firstForwarded(first);
    if (parsed !== null) {
      return parsed;
    }
  } else if (xf) {
    const parsed = firstForwarded(String(xf));
    if (parsed !== null) {
      return parsed;
    }
  }
  return req.ip;
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function mapGet(map: Map<string, number>, key: string): number {
  if (!map.has(key)) {
    return 0;
  }
  return map.get(key) as number;
}

function partAt(parts: string[], index: number): string {
  if (index >= parts.length) {
    return "";
  }
  return parts[index] as string;
}

function renderMetrics(): string {
  const lines: string[] = [
    "# HELP http_requests_total Total HTTP requests",
    "# TYPE http_requests_total counter",
  ];
  for (const [k, n] of requestCounts) {
    const parts = k.split("|");
    const service = partAt(parts, 0);
    const method = partAt(parts, 1);
    const route = partAt(parts, 2);
    const status_class = partAt(parts, 3);
    lines.push(
      `http_requests_total{service="${escapeLabel(service)}",method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_class="${escapeLabel(status_class)}"} ${n}`,
    );
  }
  lines.push(
    "# HELP http_request_duration_seconds HTTP request duration",
    "# TYPE http_request_duration_seconds summary",
  );
  for (const [k, sum] of durationSums) {
    const count = mapGet(durationCounts, k);
    const parts = k.split("|");
    const service = partAt(parts, 0);
    const method = partAt(parts, 1);
    const route = partAt(parts, 2);
    const status_class = partAt(parts, 3);
    const labels = `service="${escapeLabel(service)}",method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_class="${escapeLabel(status_class)}"`;
    lines.push(`http_request_duration_seconds_sum{${labels}} ${sum}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${count}`);
  }
  lines.push(
    "# HELP http_requests_in_flight In-flight HTTP requests",
    "# TYPE http_requests_in_flight gauge",
    `http_requests_in_flight{service="${SERVICE}"} ${inFlight}`,
  );
  return `${lines.join("\n")}\n`;
}

export function registerObservability(app: FastifyInstance): void {
  app.get("/metrics", (req, reply) => {
    const expected = config.metricsToken;
    if (expected === "") {
      return reply.code(404).send();
    }
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || auth !== `Bearer ${expected}`) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return renderMetrics();
  });

  app.addHook("onRequest", (req, _reply, done) => {
    if (req.url.startsWith("/metrics") || req.url.startsWith("/health")) {
      done();
      return;
    }
    inFlight += 1;
    (req as ObsRequest).__obsStart = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (req: FastifyRequest, reply: FastifyReply, done) => {
    if (req.url.startsWith("/metrics") || req.url.startsWith("/health")) {
      done();
      return;
    }
    inFlight = Math.max(0, inFlight - 1);
    const start = (req as ObsRequest).__obsStart;
    let durMs = 0;
    if (start !== null) {
      durMs = Number(process.hrtime.bigint() - start) / 1e6;
    }
    const route = normalizeRoute(req.url);
    const sc = statusClass(reply.statusCode);
    const labels: Labels = {
      service: SERVICE,
      method: req.method,
      route,
      status_class: sc,
    };
    const k = keyOf(labels);
    requestCounts.set(k, mapGet(requestCounts, k) + 1);
    durationSums.set(k, mapGet(durationSums, k) + durMs / 1000);
    durationCounts.set(k, mapGet(durationCounts, k) + 1);
    let path = req.url;
    const q = req.url.indexOf("?");
    if (q >= 0) {
      path = req.url.slice(0, q);
    }
    if (path.length === 0) {
      path = "/";
    }
    const line = {
      msg: "http_access",
      service: SERVICE,
      client_ip: clientIp(req),
      method: req.method,
      path,
      route,
      query: sanitizeQuery(req.url),
      status: reply.statusCode,
      duration_ms: Math.round(durMs * 100) / 100,
      request_id: req.id,
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
    done();
  });
}
