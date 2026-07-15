import type { FastifyRequest } from "fastify";
import { verifyFookieAccessToken } from "../auth/fookie.js";
import { config } from "../config.js";
import { AppError } from "../errors/app-error.js";
import { findActiveApiKeyByRaw, touchApiKeyLastUsed } from "../db/api-keys-db.js";
import { listUserRows, upsertUserFromFookie, type UserRow } from "../db/users-db.js";

function extractBearerToken(request: FastifyRequest): string {
  const authHeader = request.headers["authorization"];
  if (String(authHeader) === authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

export async function resolveAuthUser(request: FastifyRequest): Promise<UserRow> {
  const token = extractBearerToken(request);
  if (token === "") {
    throw new AppError("Unauthorized", 401);
  }

  if (config.fookieMode && !token.startsWith("tb_live_")) {
    try {
      const fookieUser = await verifyFookieAccessToken(token);
      return upsertUserFromFookie({
        sub: fookieUser.id,
        email: fookieUser.email,
        name: fookieUser.name,
      });
    } catch {
      throw new AppError("Unauthorized", 401);
    }
  }

  if (token.startsWith("tb_live_")) {
    const apiKey = findActiveApiKeyByRaw(token);
    if (!apiKey) {
      throw new AppError("Unauthorized", 401);
    }
    const rows = listUserRows({ id: apiKey.user_id, email: "", token: "" });
    const row = rows[0];
    if (!row) throw new AppError("Unauthorized", 401);
    touchApiKeyLastUsed(apiKey.id);
    return row;
  }

  const rows = listUserRows({ id: "", email: "", token });
  if (rows.length === 0) {
    throw new AppError("Unauthorized", 401);
  }
  const row = rows[0];
  if (!row) throw new AppError("Unauthorized", 401);
  return row;
}

export async function assertAuth(request: FastifyRequest): Promise<UserRow> {
  const row = await resolveAuthUser(request);
  if (!config.fookieMode && row.must_change_password === 1) {
    throw new AppError("Password change required", 403, {
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }
  return row;
}
