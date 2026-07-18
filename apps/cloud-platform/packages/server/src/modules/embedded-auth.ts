import fastifyHttpProxy from "@fastify/http-proxy";
import type { FastifyInstance } from "fastify";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

type EmbeddedAuthProcess = {
  child: ChildProcess;
  upstream: string;
};

async function waitUntilHealthy(child: ChildProcess, upstream: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (z.number().safeParse(child.exitCode).success) {
      throw new Error("embedded identity process exited during startup");
    }
    const health = await fetch(`${upstream}/healthz`).catch(() => false);
    const parsedHealth = z.instanceof(Response).safeParse(health);
    if (parsedHealth.success && parsedHealth.data.ok) {
      return;
    }
    await delay(500);
  }
  throw new Error("embedded identity process did not become healthy");
}

async function startEmbeddedAuth(app: FastifyInstance): Promise<readonly EmbeddedAuthProcess[]> {
  const binary = z.string().min(1).safeParse(process.env.EMBEDDED_AUTH_BINARY);
  if (!binary.success) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMBEDDED_AUTH_BINARY is required in production");
    }
    return [];
  }
  const upstream = "http://127.0.0.1:8081";
  const authPublicUrl = z.string().url().parse(process.env.AUTH_PUBLIC_URL);
  const childEnvironment = Object.fromEntries(
    Object.entries(process.env).concat([
      ["ADDR", "127.0.0.1:8081"],
      ["PUBLIC_URL", authPublicUrl],
    ]),
  );
  const child = spawn(binary.data, [], { env: childEnvironment, stdio: "inherit" });
  await waitUntilHealthy(child, upstream);
  app.addHook("onClose", async () => {
    if (!z.number().safeParse(child.exitCode).success) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  });
  return [{ child, upstream }];
}

export async function registerEmbeddedAuth(app: FastifyInstance, issuer: string): Promise<void> {
  const processes = await startEmbeddedAuth(app);
  if (processes.length === 0) {
    return;
  }
  const embedded = processes[0];
  if (embedded === undefined) {
    throw new Error("embedded identity process missing");
  }
  const host = new URL(issuer).host;
  await app.register(fastifyHttpProxy, {
    upstream: embedded.upstream,
    prefix: "/v1",
    rewritePrefix: "/v1",
    constraints: { host },
  });
  await app.register(fastifyHttpProxy, {
    upstream: embedded.upstream,
    prefix: "/.well-known",
    rewritePrefix: "/.well-known",
    constraints: { host },
  });
  await app.register(fastifyHttpProxy, {
    upstream: embedded.upstream,
    prefix: "/jwks.json",
    rewritePrefix: "/jwks.json",
    constraints: { host },
  });
}
