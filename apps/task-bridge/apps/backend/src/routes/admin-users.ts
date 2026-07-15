import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { AppError } from "../errors/app-error.js";
import { assertAuth } from "../middleware/auth.js";
import {
  listPublicUsers,
  createUser,
  updateUser,
  deleteUser,
  listUserRows,
  readUserToken,
  type UserRow,
} from "../db/users-db.js";

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "read-write", "read"]).default("read-write"),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(["admin", "read-write", "read"]),
});

async function requireAdmin(request: Parameters<typeof assertAuth>[0]): Promise<UserRow> {
  const user = await assertAuth(request);
  if (user.role !== "admin") {
    throw new AppError("Admin access required", 403);
  }
  return user;
}

export function adminUserRoutes(app: FastifyInstance) {
  app.get("/admin/users", async (request) => {
    await requireAdmin(request);
    return { users: listPublicUsers() };
  });

  app.post("/admin/users", async (request, reply) => {
    await requireAdmin(request);
    const body = createUserSchema.parse(request.body);
    const user = createUser({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      isSystemAdmin: false,
      mustChangePassword: true,
    });
    return reply.status(201).send({ user });
  });

  app.patch("/admin/users/:userId", async (request) => {
    await requireAdmin(request);
    const { userId } = request.params as { userId: string };
    const existingRows = listUserRows({ id: userId, email: "", token: "" });
    if (existingRows.length === 0) throw new AppError("User not found", 404);
    const existing = existingRows[0];
    if (!existing) throw new AppError("User not found", 404);
    const body = updateUserSchema.parse(request.body);
    if (existing.is_system_admin && body.role !== "admin") {
      throw new AppError("Cannot change system admin role", 400);
    }
    const updated = updateUser(userId, body);
    if (updated === null) throw new AppError("User not found", 404);
    return { user: updated };
  });

  app.delete("/admin/users/:userId", async (request, reply) => {
    await requireAdmin(request);
    const { userId } = request.params as { userId: string };
    const result = deleteUser(userId);
    if (!result.deleted) {
      let reason = "Cannot delete user";
      if (result.reason !== "") {
        reason = result.reason;
      }
      throw new AppError(reason, 400);
    }
    return reply.status(204).send();
  });

  app.get("/admin/users/:userId/token", async (request) => {
    if (config.fookieMode) {
      throw new AppError("Endpoint disabled in Fookie mode", 410);
    }
    await requireAdmin(request);
    const { userId } = request.params as { userId: string };
    const token = readUserToken(userId);
    if (token === "") throw new AppError("User not found", 404);
    return { token };
  });
}
