import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getProjectsDb } from "./projects-db.js";

export type UserRole = "admin" | "read-write" | "read";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_system_admin: number;
  token: string;
  must_change_password: number;
  created_at: string;
  updated_at: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isSystemAdmin: boolean;
  createdAt: string;
};

export type UpdateUserInput = {
  name: string;
  role: UserRole;
};

export function hasAnyUser(): boolean {
  const db = getProjectsDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count > 0;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function upsertUserFromFookie(params: {
  sub: string;
  email: string | null;
  name: string | null;
}): UserRow {
  const db = getProjectsDb();
  const existing = listUserRows({ id: params.sub, email: "", token: "" });
  const now = new Date().toISOString();
  const email =
    params.email && params.email.trim() !== ""
      ? params.email.trim().toLowerCase()
      : `${params.sub}@fookie.users`;
  const name =
    params.name && params.name.trim() !== "" ? params.name.trim() : email.split("@")[0] || "User";

  if (existing.length > 0) {
    db.prepare(
      `UPDATE users SET name = ?, email = ?, must_change_password = 0, updated_at = ? WHERE id = ?`,
    ).run(name, email, now, params.sub);
    const rows = listUserRows({ id: params.sub, email: "", token: "" });
    const row = rows[0];
    if (!row) throw new Error("Failed to load Fookie user");
    return row;
  }

  const token = generateToken();
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, is_system_admin, token, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'read-write', 0, ?, 0, ?, ?)
  `).run(params.sub, name, email, "", token, now, now);

  const rows = listUserRows({ id: params.sub, email: "", token: "" });
  const row = rows[0];
  if (!row) throw new Error("Failed to create Fookie user");
  return row;
}

export function listUserRows(filter: {
  id: string;
  email: string;
  token: string;
}): UserRow[] {
  const db = getProjectsDb();
  const id = filter.id;
  const email = filter.email;
  const token = filter.token;
  if (id !== "") {
    return db.prepare("SELECT * FROM users WHERE id = ?").all(id) as UserRow[];
  }
  if (email !== "") {
    return db.prepare("SELECT * FROM users WHERE email = ?").all(email) as UserRow[];
  }
  if (token !== "") {
    return db.prepare("SELECT * FROM users WHERE token = ?").all(token) as UserRow[];
  }
  return db
    .prepare("SELECT * FROM users ORDER BY is_system_admin DESC, created_at ASC")
    .all() as UserRow[];
}

export function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
}): PublicUser {
  const db = getProjectsDb();
  const id = randomBytes(8).toString("hex");
  const token = generateToken();
  const passwordHash = bcrypt.hashSync(params.password, 10);
  const now = new Date().toISOString();

  let isAdminFlag = 0;
  if (params.isSystemAdmin) {
    isAdminFlag = 1;
  }

  let mustChangePasswordFlag = 0;
  if (params.mustChangePassword) {
    mustChangePasswordFlag = 1;
  }

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, is_system_admin, token, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.name,
    params.email,
    passwordHash,
    params.role,
    isAdminFlag,
    token,
    mustChangePasswordFlag,
    now,
    now,
  );

  const rows = listUserRows({ id, email: "", token: "" });
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to retrieve created user");
  }
  return rowToPublic(created);
}

export function listPublicUsers(): PublicUser[] {
  return listUserRows({ id: "", email: "", token: "" }).map(rowToPublic);
}

export function deleteUser(id: string): { deleted: boolean; reason: string } {
  const rows = listUserRows({ id, email: "", token: "" });
  if (rows.length === 0) return { deleted: false, reason: "User not found" };
  const user = rows[0];
  if (!user) return { deleted: false, reason: "User not found" };
  if (user.is_system_admin) return { deleted: false, reason: "Cannot delete the system admin" };
  getProjectsDb().prepare("DELETE FROM users WHERE id = ?").run(id);
  return { deleted: true, reason: "" };
}

export function updateUser(id: string, input: UpdateUserInput): PublicUser | null {
  const rows = listUserRows({ id, email: "", token: "" });
  if (rows.length === 0) return null;
  getProjectsDb()
    .prepare(`UPDATE users SET name = ?, role = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(input.name, input.role, id);
  const updated = listUserRows({ id, email: "", token: "" });
  if (updated.length === 0) {
    return null;
  }
  const updatedRow = updated[0];
  if (!updatedRow) {
    return null;
  }
  return rowToPublic(updatedRow);
}

export function verifyPassword(user: UserRow, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

export function updateUserPassword(userId: string, newPassword: string): void {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  getProjectsDb()
    .prepare(
      `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(passwordHash, userId);
}

export function userMustChangePassword(user: UserRow): boolean {
  return user.must_change_password === 1;
}

export function readUserToken(id: string): string {
  const rows = listUserRows({ id, email: "", token: "" });
  if (rows.length === 0) return "";
  const tokenRow = rows[0];
  if (!tokenRow) return "";
  return tokenRow.token;
}

function rowToPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isSystemAdmin: row.is_system_admin === 1,
    createdAt: row.created_at,
  };
}
