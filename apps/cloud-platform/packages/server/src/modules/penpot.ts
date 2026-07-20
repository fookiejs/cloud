import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listPublicProjects,
  refreshProjectRegistry,
} from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity, IdentityUser } from "./identity.js";

type TeamBinding = {
  projectId: string;
  teamId: string;
  teamName: string;
  updatedAt: string;
  invitedEmails: string[];
};

type TeamStore = {
  teams: TeamBinding[];
};

export type PenpotModuleOptions = {
  identity: Identity;
  dataFile: string;
  publicUri: string;
  accessToken: string | null;
};

const projectIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyStore(): TeamStore {
  return { teams: [] };
}

function readStore(path: string): TeamStore {
  if (!existsSync(path)) {
    return emptyStore();
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof raw !== "object" || raw === null) {
      return emptyStore();
    }
    const record = raw as Record<string, unknown>;
    if (!Array.isArray(record["teams"])) {
      return emptyStore();
    }
    const teams: TeamBinding[] = [];
    for (const row of record["teams"]) {
      if (typeof row !== "object" || row === null) {
        continue;
      }
      const item = row as Record<string, unknown>;
      if (typeof item["projectId"] !== "string" || item["projectId"].length === 0) {
        continue;
      }
      if (typeof item["teamId"] !== "string" || item["teamId"].length === 0) {
        continue;
      }
      const teamName =
        typeof item["teamName"] === "string" && item["teamName"].length > 0
          ? item["teamName"]
          : item["projectId"];
      const updatedAt =
        typeof item["updatedAt"] === "string" && item["updatedAt"].length > 0
          ? item["updatedAt"]
          : new Date().toISOString();
      const invitedEmails = Array.isArray(item["invitedEmails"])
        ? item["invitedEmails"].filter((v): v is string => typeof v === "string")
        : [];
      teams.push({
        projectId: item["projectId"],
        teamId: item["teamId"],
        teamName,
        updatedAt,
        invitedEmails,
      });
    }
    return { teams };
  } catch {
    return emptyStore();
  }
}

function writeStore(path: string, store: TeamStore): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function bindingFor(store: TeamStore, projectId: string): TeamBinding | null {
  for (const row of store.teams) {
    if (row.projectId === projectId) {
      return row;
    }
  }
  return null;
}

function upsertBinding(store: TeamStore, next: TeamBinding): TeamStore {
  const teams: TeamBinding[] = [];
  let replaced = false;
  for (const row of store.teams) {
    if (row.projectId === next.projectId) {
      teams.push(next);
      replaced = true;
    } else {
      teams.push(row);
    }
  }
  if (!replaced) {
    teams.push(next);
  }
  return { teams };
}

function teamOpenUrl(publicUri: string, teamId: string): string {
  const base = publicUri.replace(/\/$/, "");
  return `${base}/#/team/${teamId}`;
}

async function penpotRpc<T>(
  publicUri: string,
  accessToken: string,
  command: string,
  body: Record<string, unknown> | null,
): Promise<T> {
  const base = publicUri.replace(/\/$/, "");
  const headers = new Headers({
    Authorization: `Token ${accessToken}`,
    Accept: "application/json",
  });
  let method = "GET";
  let payload: string | undefined;
  if (body !== null) {
    method = "POST";
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  } else if (!command.startsWith("get-")) {
    method = "POST";
    headers.set("Content-Type", "application/json");
    payload = "{}";
  }
  const response = await fetch(`${base}/api/rpc/command/${command}`, {
    method,
    headers,
    body: payload,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`penpot ${command} failed: ${String(response.status)} ${text}`);
  }
  if (text.length === 0) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

function teamIdFromCreate(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record["id"] === "string" && record["id"].length > 0) {
    return record["id"];
  }
  return null;
}

export async function registerPenpotModule(
  app: FastifyInstance,
  options: PenpotModuleOptions,
): Promise<void> {
  const projectParamsSchema = z.object({
    projectId: z.string().trim().regex(projectIdPattern),
  });

  async function requireOwnedProject(
    user: IdentityUser,
    projectId: string,
  ): Promise<{ id: string; name: string } | null> {
    refreshProjectRegistry();
    const projects = listPublicProjects(user.id);
    for (const project of projects) {
      if (project.id === projectId) {
        return { id: project.id, name: project.name };
      }
    }
    return null;
  }

  async function ensureTeam(
    project: { id: string; name: string },
    user: IdentityUser,
  ): Promise<{
    teamId: string | null;
    openUrl: string;
    provisioned: boolean;
    invited: boolean;
    message: string | null;
  }> {
    const store = readStore(options.dataFile);
    const existing = bindingFor(store, project.id);
    if (existing !== null) {
      // Already provisioned AND already invited this exact user — skip the network
      // round trip to Penpot entirely. Re-inviting on every page load was the actual
      // cause of Designs taking ~20s to open on every single visit.
      const alreadyInvited =
        user.email !== null && existing.invitedEmails.includes(user.email.toLowerCase());
      if (alreadyInvited) {
        return {
          teamId: existing.teamId,
          openUrl: teamOpenUrl(options.publicUri, existing.teamId),
          provisioned: true,
          invited: true,
          message: null,
        };
      }
      let invited = false;
      if (options.accessToken !== null && user.email !== null && user.email.length > 0) {
        try {
          await penpotRpc(options.publicUri, options.accessToken, "create-team-invitations", {
            "team-id": existing.teamId,
            emails: [user.email],
            role: "editor",
          });
          invited = true;
          writeStore(
            options.dataFile,
            upsertBinding(store, {
              ...existing,
              invitedEmails: [...existing.invitedEmails, user.email.toLowerCase()],
            }),
          );
        } catch {
          invited = false;
        }
      }
      return {
        teamId: existing.teamId,
        openUrl: teamOpenUrl(options.publicUri, existing.teamId),
        provisioned: true,
        invited,
        message: null,
      };
    }

    if (options.accessToken === null) {
      return {
        teamId: null,
        openUrl: options.publicUri.replace(/\/$/, ""),
        provisioned: false,
        invited: false,
        message:
          "Penpot service token is not configured. Open Penpot and create a team manually, or set PENPOT_ACCESS_TOKEN.",
      };
    }

    const teamName = `Cloud · ${project.name}`;
    const created = await penpotRpc(options.publicUri, options.accessToken, "create-team", {
      name: teamName,
    });
    const teamId = teamIdFromCreate(created);
    if (teamId === null) {
      throw new Error("penpot create-team returned no id");
    }
    let invited = false;
    const invitedEmails: string[] = [];
    if (user.email !== null && user.email.length > 0) {
      try {
        await penpotRpc(options.publicUri, options.accessToken, "create-team-invitations", {
          "team-id": teamId,
          emails: [user.email],
          role: "editor",
        });
        invited = true;
        invitedEmails.push(user.email.toLowerCase());
      } catch {
        invited = false;
      }
    }
    writeStore(
      options.dataFile,
      upsertBinding(store, {
        projectId: project.id,
        teamId,
        teamName,
        updatedAt: new Date().toISOString(),
        invitedEmails,
      }),
    );

    return {
      teamId,
      openUrl: teamOpenUrl(options.publicUri, teamId),
      provisioned: true,
      invited,
      message: null,
    };
  }

  app.get("/api/projects/:projectId/designs", async (request, reply) => {
    const user = await options.identity.userFrom(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await requireOwnedProject(user, projectId);
    if (project === null) {
      return reply.code(404).send({ error: "Project not found" });
    }
    try {
      const ensured = await ensureTeam(project, user);
      return {
        projectId: project.id,
        projectName: project.name,
        teamId: ensured.teamId,
        openUrl: ensured.openUrl,
        provisioned: ensured.provisioned,
        invited: ensured.invited,
        message: ensured.message,
        publicUri: options.publicUri.replace(/\/$/, ""),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "penpot provision failed";
      return reply.code(502).send({ error: message });
    }
  });

  app.post("/api/projects/:projectId/designs/ensure", async (request, reply) => {
    const user = await options.identity.userFrom(request);
    if (user === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await requireOwnedProject(user, projectId);
    if (project === null) {
      return reply.code(404).send({ error: "Project not found" });
    }
    try {
      const ensured = await ensureTeam(project, user);
      return reply.code(ensured.provisioned ? 200 : 503).send({
        projectId: project.id,
        projectName: project.name,
        teamId: ensured.teamId,
        openUrl: ensured.openUrl,
        provisioned: ensured.provisioned,
        invited: ensured.invited,
        message: ensured.message,
        publicUri: options.publicUri.replace(/\/$/, ""),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "penpot provision failed";
      return reply.code(502).send({ error: message });
    }
  });
}
