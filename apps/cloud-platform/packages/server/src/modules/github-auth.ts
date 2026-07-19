import Database from "better-sqlite3";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { Identity, IdentityUser } from "./identity.js";

export type GithubAuthOptions = {
  identity: Identity;
  dataDir: string;
  publicUrl: string;
  clientId: string | null;
  clientSecret: string | null;
};

export type GithubAccount = {
  userId: string;
  login: string;
  email: string | null;
  connectedAt: number;
};

export type GithubAuth = {
  isConfigured(): boolean;
  getAccessToken(userId: string): string | null;
  getAccount(userId: string): GithubAccount | null;
};

type AccountRow = {
  user_id: string;
  login: string;
  email: string | null;
  access_token: string;
  connected_at: number;
};

export async function registerGithubAuthModule(
  app: FastifyInstance,
  options: GithubAuthOptions,
): Promise<GithubAuth> {
  const db = new Database(join(options.dataDir, "github.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_accounts (
      user_id TEXT PRIMARY KEY,
      login TEXT NOT NULL,
      email TEXT,
      access_token TEXT NOT NULL,
      connected_at INTEGER NOT NULL
    );
  `);

  const configured = options.clientId !== null && options.clientSecret !== null;

  // Short-lived state -> requesting user mapping for the OAuth round trip. GitHub's
  // callback is a plain browser redirect with no auth header, so this is how we
  // recover which Fookie account is connecting.
  const pendingStates = new Map<string, { userId: string; expiresAt: number }>();
  function sweepPendingStates(): void {
    const now = Date.now();
    for (const [state, entry] of pendingStates) {
      if (entry.expiresAt < now) {
        pendingStates.delete(state);
      }
    }
  }

  function getRow(userId: string): AccountRow | null {
    const row = db.prepare("SELECT * FROM github_accounts WHERE user_id = ?").get(userId) as
      | AccountRow
      | undefined;
    return row === undefined ? null : row;
  }

  async function requireUser(request: FastifyRequest): Promise<IdentityUser | null> {
    return options.identity.userFrom(request);
  }

  app.get("/api/v1/github/status", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const row = getRow(user.id);
    return {
      configured,
      connected: row !== null,
      login: row !== null ? row.login : null,
    };
  });

  app.get("/api/v1/github/connect", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!configured) {
      return reply.code(503).send({ error: "github oauth is not configured" });
    }
    sweepPendingStates();
    const state = randomBytes(24).toString("base64url");
    pendingStates.set(state, { userId: user.id, expiresAt: Date.now() + 10 * 60_000 });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", options.clientId ?? "");
    url.searchParams.set("redirect_uri", `${options.publicUrl}/api/v1/github/callback`);
    url.searchParams.set("scope", "repo read:user user:email");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

  app.get("/api/v1/github/callback", async (request, reply) => {
    const query = request.query as { code?: unknown; state?: unknown };
    if (typeof query.code !== "string" || typeof query.state !== "string" || !configured) {
      return reply.code(400).send({ error: "invalid_callback" });
    }
    sweepPendingStates();
    const pending = pendingStates.get(query.state);
    if (pending === undefined) {
      return reply.code(400).send({ error: "invalid_or_expired_state" });
    }
    pendingStates.delete(query.state);

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: query.code,
        redirect_uri: `${options.publicUrl}/api/v1/github/callback`,
      }),
    });
    if (!tokenResponse.ok) {
      return reply.code(502).send({ error: "github_token_exchange_failed" });
    }
    const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
    if (typeof tokenBody.access_token !== "string") {
      return reply.code(502).send({ error: "github_token_exchange_failed" });
    }
    const accessToken = tokenBody.access_token;

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json" },
    });
    if (!profileResponse.ok) {
      return reply.code(502).send({ error: "github_profile_fetch_failed" });
    }
    const profile = (await profileResponse.json()) as { login?: unknown; email?: unknown };
    const login = typeof profile.login === "string" ? profile.login : "unknown";
    let email = typeof profile.email === "string" ? profile.email : null;
    if (email === null) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json" },
      });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as { email: string; primary: boolean }[];
        const primary = emails.find((entry) => entry.primary);
        email = primary?.email ?? emails[0]?.email ?? null;
      }
    }

    db.prepare(
      `INSERT INTO github_accounts (user_id, login, email, access_token, connected_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         login = excluded.login,
         email = excluded.email,
         access_token = excluded.access_token,
         connected_at = excluded.connected_at`,
    ).run(pending.userId, login, email, accessToken, Date.now());

    return reply.redirect("/");
  });

  app.post("/api/v1/github/disconnect", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    db.prepare("DELETE FROM github_accounts WHERE user_id = ?").run(user.id);
    return { ok: true };
  });

  app.get("/api/v1/github/repos", async (request, reply) => {
    const user = await requireUser(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const row = getRow(user.id);
    if (row === null) {
      return reply.code(409).send({ error: "github not connected" });
    }
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          authorization: `Bearer ${row.access_token}`,
          accept: "application/vnd.github+json",
        },
      },
    );
    if (!reposResponse.ok) {
      return reply.code(502).send({ error: "github_repos_fetch_failed" });
    }
    const repos = (await reposResponse.json()) as {
      full_name: string;
      private: boolean;
      default_branch: string;
    }[];
    return {
      repos: repos.map((repo) => ({
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
      })),
    };
  });

  return {
    isConfigured(): boolean {
      return configured;
    },
    getAccessToken(userId: string): string | null {
      const row = getRow(userId);
      return row === null ? null : row.access_token;
    },
    getAccount(userId: string): GithubAccount | null {
      const row = getRow(userId);
      if (row === null) {
        return null;
      }
      return { userId: row.user_id, login: row.login, email: row.email, connectedAt: row.connected_at };
    },
  };
}
