import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "notes.json");
const AUTH_ISSUER = (process.env.FOOKIE_AUTH_ISSUER || "https://auth.fookiecloud.com").replace(
  /\/$/,
  "",
);
const INTROSPECT_SECRET = process.env.FOOKIE_INTROSPECT_SECRET || "";
const WRITE_KEY = process.env.NOTES_WRITE_KEY || "";
const ADMIN_EMAILS = String(process.env.FOOKIE_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_PATH)) {
  fs.writeFileSync(STORE_PATH, "[]\n", "utf8");
}

const authCache = new Map();

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(notes) {
  fs.writeFileSync(STORE_PATH, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function bearer(req) {
  const h = req.headers.authorization;
  if (typeof h !== "string" || !h.startsWith("Bearer ")) return "";
  return h.slice(7).trim();
}

async function resolveUser(token) {
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const res = await fetch(`${AUTH_ISSUER}/v1/userinfo`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const email = String(data?.email || "").toLowerCase();
      const value = email ? { email, sub: data?.sub || null } : null;
      authCache.set(token, { value, expiresAt: Date.now() + 60_000 });
      return value;
    }
  } catch {
  }

  if (!INTROSPECT_SECRET) {
    authCache.set(token, { value: null, expiresAt: Date.now() + 15_000 });
    return null;
  }

  try {
    const res = await fetch(`${AUTH_ISSUER}/v1/introspect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INTROSPECT_SECRET}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      authCache.set(token, { value: null, expiresAt: Date.now() + 15_000 });
      return null;
    }
    const data = await res.json();
    const active = Boolean(data?.active);
    const email = String(data?.email || data?.username || "").toLowerCase();
    const value = active && email ? { email, sub: data?.sub || null } : null;
    authCache.set(token, { value, expiresAt: Date.now() + 60_000 });
    return value;
  } catch {
    authCache.set(token, { value: null, expiresAt: Date.now() + 15_000 });
    return null;
  }
}

async function authorize(req) {
  const token = bearer(req);
  if (!token) return null;
  if (WRITE_KEY && token === WRITE_KEY) {
    return { email: "ops-metrics", role: "write" };
  }
  const user = await resolveUser(token);
  if (!user) return null;
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email)) {
    return null;
  }
  return { ...user, role: "read" };
}

function publicDir() {
  return path.join(__dirname, "..", "public");
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  rel = rel.split("?")[0];
  if (rel.includes("..")) {
    res.writeHead(400).end();
    return;
  }
  const root = publicDir();
  let filePath = path.join(root, rel);
  if (!filePath.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
  if (url.pathname === "/healthz") {
    json(res, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/notes" && req.method === "GET") {
    const auth = await authorize(req);
    if (!auth) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    const notes = readStore()
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(({ id, title, source, createdAt, seenAt }) => ({
        id,
        title,
        source,
        createdAt,
        seenAt,
        seen: Boolean(seenAt),
      }));
    json(res, 200, { notes });
    return;
  }

  const one = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
  if (one && req.method === "GET") {
    const auth = await authorize(req);
    if (!auth) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    const note = readStore().find((n) => n.id === one[1]);
    if (!note) {
      json(res, 404, { error: "not found" });
      return;
    }
    json(res, 200, note);
    return;
  }

  if (url.pathname === "/api/notes" && req.method === "POST") {
    const auth = await authorize(req);
    if (!auth) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "invalid json" });
      return;
    }
    const title = String(body.title || "").trim();
    const text = String(body.body ?? body.text ?? "").trim();
    if (!title || !text) {
      json(res, 400, { error: "title and body required" });
      return;
    }
    const note = {
      id: randomUUID(),
      title: title.slice(0, 200),
      body: text.slice(0, 200_000),
      source: String(body.source || "manual").slice(0, 80),
      createdAt: new Date().toISOString(),
      seenAt: null,
      createdBy: auth.email || "unknown",
    };
    const notes = readStore();
    notes.push(note);
    writeStore(notes);
    json(res, 201, note);
    return;
  }

  if (one && req.method === "PATCH") {
    const auth = await authorize(req);
    if (!auth) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "invalid json" });
      return;
    }
    const notes = readStore();
    const idx = notes.findIndex((n) => n.id === one[1]);
    if (idx < 0) {
      json(res, 404, { error: "not found" });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(body, "seen")) {
      notes[idx].seenAt = body.seen ? new Date().toISOString() : null;
    }
    writeStore(notes);
    json(res, 200, notes[idx]);
    return;
  }

  json(res, 404, { error: "not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    json(res, 500, { error: "internal", message: String(err?.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`notes listening on ${PORT}\n`);
});
