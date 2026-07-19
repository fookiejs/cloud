import type { FastifyInstance, FastifyRequest } from "fastify";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { userCanAccessProject } from "../../../../../task-bridge/apps/backend/dist/services/project-registry.js";
import type { Identity } from "./identity.js";

type Note = {
  id: string;
  title: string;
  body: string;
  source: string;
  createdAt: string;
  seenAt: string | null;
  createdBy: string;
  projectId: string;
};

type Viewer = { email: string; sub: string };

type NotesOptions = {
  dataFile: string;
  adminEmails: Set<string>;
  identity: Identity;
};

async function viewerFrom(request: FastifyRequest, options: NotesOptions): Promise<Viewer | null> {
  const user = await options.identity.userFrom(request);
  if (user === null || user.email === null) {
    return null;
  }
  if (options.adminEmails.size > 0 && !options.adminEmails.has(user.email)) {
    return null;
  }
  return { email: user.email, sub: user.id };
}

async function readNotes(dataFile: string): Promise<Note[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(dataFile, "utf8"));
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
}

async function saveNotes(dataFile: string, notes: Note[]): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, `${JSON.stringify(notes, null, 2)}\n`, "utf8");
  await rename(temporary, dataFile);
}

export async function registerNotesModule(app: FastifyInstance, options: NotesOptions): Promise<void> {
  app.get<{ Querystring: { projectId?: string } }>("/api/notes", async (request, reply) => {
    const viewer = await viewerFrom(request, options);
    if (!viewer) return reply.code(401).send({ error: "unauthorized" });
    const projectFilter = String(request.query?.projectId ?? "").trim();
    if (projectFilter.length === 0) return reply.code(400).send({ error: "projectId required" });
    if (!userCanAccessProject(projectFilter, viewer.sub)) return reply.code(404).send({ error: "not found" });
    const notes = await readNotes(options.dataFile);
    return {
      notes: notes
        .filter((note) => note.projectId === projectFilter)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ id, title, source, createdAt, seenAt }) => ({ id, title, source, createdAt, seenAt, seen: Boolean(seenAt) })),
    };
  });

  app.get<{ Params: { id: string } }>("/api/notes/:id", async (request, reply) => {
    const viewer = await viewerFrom(request, options);
    if (!viewer) return reply.code(401).send({ error: "unauthorized" });
    const note = (await readNotes(options.dataFile)).find((item) => item.id === request.params.id);
    if (!note || !userCanAccessProject(note.projectId, viewer.sub)) {
      return reply.code(404).send({ error: "not found" });
    }
    return note;
  });

  app.post<{ Body: { title?: unknown; body?: unknown; text?: unknown; source?: unknown; projectId?: unknown } }>("/api/notes", async (request, reply) => {
    const viewer = await viewerFrom(request, options);
    if (!viewer) return reply.code(401).send({ error: "unauthorized" });
    const title = String(request.body?.title ?? "").trim();
    const body = String(request.body?.body ?? request.body?.text ?? "").trim();
    const projectId = String(request.body?.projectId ?? "").trim();
    if (!title || !body) return reply.code(400).send({ error: "title and body required" });
    if (!projectId) return reply.code(400).send({ error: "projectId required" });
    if (!userCanAccessProject(projectId, viewer.sub)) return reply.code(404).send({ error: "not found" });
    const note: Note = {
      id: randomUUID(), title: title.slice(0, 200), body: body.slice(0, 200_000),
      source: String(request.body?.source ?? "manual").slice(0, 80), createdAt: new Date().toISOString(),
      seenAt: null, createdBy: viewer.email, projectId,
    };
    const notes = await readNotes(options.dataFile);
    notes.push(note);
    await saveNotes(options.dataFile, notes);
    return reply.code(201).send(note);
  });

  app.patch<{ Params: { id: string }; Body: { seen?: unknown } }>("/api/notes/:id", async (request, reply) => {
    const viewer = await viewerFrom(request, options);
    if (!viewer) return reply.code(401).send({ error: "unauthorized" });
    const notes = await readNotes(options.dataFile);
    const index = notes.findIndex((item) => item.id === request.params.id);
    if (index < 0 || !userCanAccessProject(notes[index].projectId, viewer.sub)) {
      return reply.code(404).send({ error: "not found" });
    }
    if (Object.hasOwn(request.body ?? {}, "seen")) notes[index].seenAt = request.body?.seen ? new Date().toISOString() : null;
    await saveNotes(options.dataFile, notes);
    return notes[index];
  });
}
