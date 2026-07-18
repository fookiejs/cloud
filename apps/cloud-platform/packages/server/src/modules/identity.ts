import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
} from "jose";
import { createHash, randomBytes } from "node:crypto";

export type IdentityUser = {
  id: string;
  email: string | null;
  name: string | null;
  clientId: string;
};

export type Identity = {
  issuer: string;
  clientId: string;
  verifyAccessToken(token: string): Promise<IdentityUser>;
  userFrom(request: FastifyRequest): Promise<IdentityUser | null>;
  register(app: FastifyInstance): Promise<void>;
};

type IdentityOptions = {
  issuer: string;
  publicUrl: string;
  clientId: string;
  localViewerEmail: string | null;
  localViewerName: string;
};

type JoseKey = Awaited<ReturnType<typeof importJWK>>;

type LocalKeys = {
  signingKey: JoseKey;
  verificationKey: JoseKey;
  publicJwk: JWK;
};

function bearer(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) {
    return null;
  }
  const token = value.slice(7).trim();
  return token.length > 0 ? token : null;
}

function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function cookiesFrom(request: FastifyRequest): Map<string, string> {
  const cookies = new Map<string, string>();
  const header = request.headers.cookie;
  if (typeof header !== "string") {
    return cookies;
  }
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator > 0) {
      cookies.set(entry.slice(0, separator).trim(), decodeURIComponent(entry.slice(separator + 1).trim()));
    }
  }
  return cookies;
}

function cookie(name: string, value: string, secure: boolean, maxAge: number): string {
  const secureField = secure ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureField}`;
}

function clearCookie(name: string, secure: boolean): string {
  return cookie(name, "", secure, 0);
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function tokenClientId(payload: Record<string, unknown>): string {
  const direct = payload["client_id"];
  if (typeof direct === "string") {
    return direct;
  }
  const audience = payload["aud"];
  if (typeof audience === "string") {
    return audience;
  }
  if (Array.isArray(audience) && typeof audience[0] === "string") {
    return audience[0];
  }
  return "";
}

async function localKeys(): Promise<LocalKeys> {
  const privateValue = process.env.FOOKIE_AUTH_PRIVATE_JWK;
  const publicValue = process.env.FOOKIE_AUTH_PUBLIC_JWK;
  if (privateValue !== undefined || publicValue !== undefined) {
    if (privateValue === undefined || publicValue === undefined) {
      throw new Error("FOOKIE_AUTH_PRIVATE_JWK and FOOKIE_AUTH_PUBLIC_JWK must be configured together");
    }
    const privateJwk = JSON.parse(privateValue) as JWK;
    const publicJwk = JSON.parse(publicValue) as JWK;
    return {
      signingKey: await importJWK(privateJwk, "RS256"),
      verificationKey: await importJWK(publicJwk, "RS256"),
      publicJwk,
    };
  }
  if (process.env.NODE_ENV !== "development") {
    throw new Error("local identity keys are only generated in development");
  }
  const generated = await generateKeyPair("RS256", { extractable: true });
  return {
    signingKey: generated.privateKey,
    verificationKey: generated.publicKey,
    publicJwk: await exportJWK(generated.publicKey),
  };
}

export async function createIdentity(options: IdentityOptions): Promise<Identity> {
  const issuer = options.issuer.replace(/\/$/, "");
  const publicUrl = options.publicUrl.replace(/\/$/, "");
  const secureCookies = publicUrl.startsWith("https://");
  const remoteJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const local = options.localViewerEmail === null ? null : await localKeys();
  if (local !== null) {
    local.publicJwk.kid = "fookie-cloud-local";
    local.publicJwk.use = "sig";
    local.publicJwk.alg = "RS256";
  }

  async function issueLocalToken(): Promise<string> {
    if (local === null || options.localViewerEmail === null) {
      throw new Error("local session is disabled");
    }
    const email = options.localViewerEmail;
    return new SignJWT({ email, name: options.localViewerName, client_id: options.clientId })
      .setProtectedHeader({ alg: "RS256", kid: local.publicJwk.kid })
      .setIssuer(publicUrl)
      .setSubject(`local:${email}`)
      .setAudience(options.clientId)
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(local.signingKey);
  }

  async function verifyAccessToken(token: string): Promise<IdentityUser> {
    let payload: Record<string, unknown>;
    if (local !== null) {
      try {
        const verified = await jwtVerify(token, local.verificationKey, {
          issuer: publicUrl,
          algorithms: ["RS256"],
        });
        payload = verified.payload;
      } catch {
        const verified = await jwtVerify(token, remoteJwks, {
          issuer,
          algorithms: ["RS256"],
        });
        payload = verified.payload;
      }
    } else {
      const verified = await jwtVerify(token, remoteJwks, {
        issuer,
        algorithms: ["RS256"],
      });
      payload = verified.payload;
    }
    const id = payload["sub"];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("access token missing subject");
    }
    return {
      id,
      email: typeof payload["email"] === "string" ? payload["email"].toLowerCase() : null,
      name: typeof payload["name"] === "string" ? payload["name"] : null,
      clientId: tokenClientId(payload),
    };
  }

  async function userFrom(request: FastifyRequest): Promise<IdentityUser | null> {
    const token = bearer(request);
    if (token === null) {
      return null;
    }
    try {
      return await verifyAccessToken(token);
    } catch {
      return null;
    }
  }

  return {
    issuer,
    clientId: options.clientId,
    verifyAccessToken,
    userFrom,
    async register(app): Promise<void> {
      app.get("/api/auth/.well-known/jwks.json", async (_request, reply) => {
        if (local !== null) {
          return { keys: [local.publicJwk] };
        }
        const response = await fetch(`${issuer}/.well-known/jwks.json`);
        return reply.code(response.status).type("application/json").send(await response.text());
      });
      app.get("/api/auth/login", async (request, reply) => {
        const returnTo = safeReturnTo((request.query as { return_to?: unknown }).return_to);
        if (local !== null) {
          return reply.redirect(returnTo);
        }
        const verifier = base64url(randomBytes(32));
        const state = base64url(randomBytes(24));
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        const loginUrl = new URL(`${issuer}/v1/login`);
        loginUrl.searchParams.set("client_id", options.clientId);
        loginUrl.searchParams.set("redirect_uri", `${publicUrl}/api/auth/callback`);
        loginUrl.searchParams.set("state", state);
        loginUrl.searchParams.set("code_challenge", challenge);
        loginUrl.searchParams.set("code_challenge_method", "S256");
        reply.header("Set-Cookie", [
          cookie("fookie_adapter_state", state, secureCookies, 600),
          cookie("fookie_adapter_verifier", verifier, secureCookies, 600),
          cookie("fookie_adapter_return", returnTo, secureCookies, 600),
        ]);
        return reply.redirect(loginUrl.toString());
      });
      app.get("/api/auth/callback", async (request, reply) => {
        const query = request.query as { code?: unknown; state?: unknown };
        const cookies = cookiesFrom(request);
        const state = cookies.get("fookie_adapter_state");
        const verifier = cookies.get("fookie_adapter_verifier");
        if (typeof query.code !== "string" || query.state !== state || verifier === undefined) {
          return reply.code(400).send({ error: "invalid_auth_callback" });
        }
        const response = await fetch(`${issuer}/v1/token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: query.code,
            redirect_uri: `${publicUrl}/api/auth/callback`,
            client_id: options.clientId,
            code_verifier: verifier,
          }),
        });
        if (!response.ok) {
          return reply.code(502).send({ error: "identity_exchange_failed" });
        }
        const tokens = (await response.json()) as {
          access_token?: unknown;
          refresh_token?: unknown;
          expires_in?: unknown;
        };
        if (typeof tokens.access_token !== "string") {
          return reply.code(502).send({ error: "identity_exchange_failed" });
        }
        const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : 900;
        const responseCookies = [
          cookie("fookie_access_token", tokens.access_token, secureCookies, expiresIn),
          clearCookie("fookie_adapter_state", secureCookies),
          clearCookie("fookie_adapter_verifier", secureCookies),
          clearCookie("fookie_adapter_return", secureCookies),
        ];
        if (typeof tokens.refresh_token === "string") {
          responseCookies.push(cookie("fookie_refresh_token", tokens.refresh_token, secureCookies, 2_592_000));
        }
        reply.header("Set-Cookie", responseCookies);
        return reply.redirect(safeReturnTo(cookies.get("fookie_adapter_return")));
      });
      app.get("/api/auth/session", async (request, reply) => {
        if (local !== null) {
          return { access_token: await issueLocalToken(), token_type: "Bearer", expires_in: 28_800 };
        }
        const sessionCookies = cookiesFrom(request);
        const accessToken = sessionCookies.get("fookie_access_token");
        if (accessToken !== undefined) {
          try {
            await verifyAccessToken(accessToken);
            return { access_token: accessToken, token_type: "Bearer" };
          } catch {
            reply.header("Set-Cookie", clearCookie("fookie_access_token", secureCookies));
          }
        }
        const refreshToken = sessionCookies.get("fookie_refresh_token");
        if (refreshToken === undefined) {
          return reply.code(401).send({ error: "unauthenticated" });
        }
        const response = await fetch(`${issuer}/v1/token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: options.clientId,
          }),
        });
        if (!response.ok) {
          return reply.code(401).send({ error: "unauthenticated" });
        }
        const tokens = (await response.json()) as {
          access_token?: unknown;
          refresh_token?: unknown;
          expires_in?: unknown;
        };
        if (typeof tokens.access_token !== "string") {
          return reply.code(502).send({ error: "identity_refresh_failed" });
        }
        const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : 900;
        const nextRefresh =
          typeof tokens.refresh_token === "string" ? tokens.refresh_token : refreshToken;
        reply.header("Set-Cookie", [
          cookie("fookie_access_token", tokens.access_token, secureCookies, expiresIn),
          cookie("fookie_refresh_token", nextRefresh, secureCookies, 2_592_000),
        ]);
        return { access_token: tokens.access_token, token_type: "Bearer", expires_in: expiresIn };
      });
      app.get("/api/auth/userinfo", async (request, reply) => {
        const user = await userFrom(request);
        if (user === null) {
          return reply.code(401).send({ error: "unauthorized" });
        }
        return { sub: user.id, email: user.email, name: user.name, client_id: user.clientId };
      });
      app.get("/api/auth/me", async (request, reply) => {
        const user = await userFrom(request);
        if (user === null) {
          return reply.code(401).send({ error: "unauthorized" });
        }
        return { id: user.id, name: user.name, email: user.email, role: "user", isSystemAdmin: false };
      });
      app.post("/api/auth/logout", async (_request, reply) => {
        reply.header("Set-Cookie", [
          clearCookie("fookie_access_token", secureCookies),
          clearCookie("fookie_refresh_token", secureCookies),
        ]);
        return reply.code(204).send();
      });
    },
  };
}
