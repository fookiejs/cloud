import { createHash, randomBytes } from "node:crypto";
import { getProjectsDb } from "./projects-db.js";

export type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function newId(): string {
  return randomBytes(8).toString("hex");
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function migrateApiKeysTables() {
  getProjectsDb().exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
  `);
}

export function listApiKeyRows(userId: string): ApiKeyRow[] {
  migrateApiKeysTables();
  return getProjectsDb()
    .prepare(
      `SELECT * FROM api_keys
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all(userId) as ApiKeyRow[];
}

export function findActiveApiKeyByRaw(rawKey: string): ApiKeyRow | null {
  migrateApiKeysTables();
  const row = getProjectsDb()
    .prepare(
      `SELECT * FROM api_keys
       WHERE key_hash = ? AND revoked_at IS NULL`,
    )
    .get(hashKey(rawKey)) as ApiKeyRow | undefined;
  return row ?? null;
}

export function touchApiKeyLastUsed(id: string) {
  migrateApiKeysTables();
  getProjectsDb()
    .prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`)
    .run(id);
}

export function createApiKey(userId: string, name: string): {
  key: ApiKeySummary;
  rawKey: string;
} {
  migrateApiKeysTables();
  const id = newId();
  const rawKey = `tb_live_${randomBytes(24).toString("hex")}`;
  const keyPrefix = `${rawKey.slice(0, 16)}…`;
  getProjectsDb()
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, userId, name.trim() || "API key", keyPrefix, hashKey(rawKey));
  const row = getProjectsDb()
    .prepare("SELECT * FROM api_keys WHERE id = ?")
    .get(id) as ApiKeyRow;
  return {
    rawKey,
    key: rowToSummary(row),
  };
}

export function revokeApiKey(userId: string, keyId: string): boolean {
  migrateApiKeysTables();
  const result = getProjectsDb()
    .prepare(
      `UPDATE api_keys
       SET revoked_at = datetime('now')
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    )
    .run(keyId, userId);
  return result.changes > 0;
}

export function rowToSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}
