import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";
import { assertAuth } from "../middleware/auth.js";
import { getProjectById } from "../services/project-registry.js";
import {
  createLibrary,
  getLibrary,
  getLibraryDocument,
  linkDocumentToTask,
  listLibraries,
  listLibrarySyncManifest,
  listTaskLibraryLinks,
  readLibraryDocumentContent,
  removeLibrary,
  removeLibraryDocument,
  renameLibraryDocument,
  replaceLibraryDocumentFile,
  unlinkDocumentFromTask,
  updateLibrary,
  uploadLibraryDocument,
} from "../services/library-service.js";

const projectIdParamsSchema = z.object({
  projectId: z.string().trim().min(1),
});

const projectLibraryParamsSchema = z.object({
  projectId: z.string().trim().min(1),
  libraryId: z.string().trim().min(1),
});

const projectLibraryDocumentParamsSchema = z.object({
  projectId: z.string().trim().min(1),
  libraryId: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
});

const documentIdParamsSchema = z.object({
  documentId: z.string().trim().min(1),
});

const taskIdParamsSchema = z.object({
  taskId: z.coerce.number().int().positive(),
});

const createLibrarySchema = z.object({
  id: z.string().trim().default(""),
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
});

const updateLibrarySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().default(""),
});

const renameDocumentSchema = z.object({
  title: z.string().trim().min(1),
});

const linkDocumentSchema = z.object({
  taskId: z.coerce.number().int().positive(),
});

const syncQuerySchema = z.object({
  libraryId: z.string().trim().default(""),
});

type MultipartFileField = {
  type: "file";
  filename: string;
  mimetype: string;
  toBuffer: () => Promise<Buffer>;
};

type MultipartValueField = {
  type: "field";
  value: string;
};

async function readMultipartFile(request: { body: unknown }) {
  const body = request.body as Record<string, MultipartFileField | MultipartValueField | undefined>;
  const fileField = body.file;
  if (!fileField || fileField.type !== "file") {
    throw new AppError("file is required", 400);
  }
  const buffer = await fileField.toBuffer();
  let title = "";
  const titleField = body.title;
  if (titleField && titleField.type === "field") {
    title = titleField.value;
  }
  return {
    filename: fileField.filename || "upload.bin",
    mimeType: fileField.mimetype || "application/octet-stream",
    buffer,
    title,
  };
}

export async function libraryRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  });

  app.get("/projects/:projectId/libraries", async (request) => {
    const user = await assertAuth(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    return { items: listLibraries(projectId, user.id) };
  });

  app.get("/projects/:projectId/library/sync", async (request) => {
    const user = await assertAuth(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const query = syncQuerySchema.parse(request.query || {});
    return { items: listLibrarySyncManifest(projectId, query.libraryId, user.id) };
  });

  app.post("/projects/:projectId/libraries", async (request, reply) => {
    const user = await assertAuth(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    let rawBody = request.body;
    if (rawBody === null) {
      rawBody = {};
    }
    const body = createLibrarySchema.parse(rawBody);
    const library = createLibrary(projectId, body, user.id);
    return reply.status(201).send(library);
  });

  app.get("/projects/:projectId/libraries/:libraryId", async (request, reply) => {
    const user = await assertAuth(request);
    const { projectId, libraryId } = projectLibraryParamsSchema.parse(request.params);
    const library = getLibrary(projectId, libraryId, user.id);
    if (!library) return reply.status(404).send({ error: "Library not found" });
    return library;
  });

  app.put("/projects/:projectId/libraries/:libraryId", async (request) => {
    const user = await assertAuth(request);
    const { projectId, libraryId } = projectLibraryParamsSchema.parse(request.params);
    let rawBody = request.body;
    if (rawBody === null) {
      rawBody = {};
    }
    const body = updateLibrarySchema.parse(rawBody);
    return updateLibrary(projectId, libraryId, body, user.id);
  });

  app.delete("/projects/:projectId/libraries/:libraryId", async (request, reply) => {
    const user = await assertAuth(request);
    const { projectId, libraryId } = projectLibraryParamsSchema.parse(request.params);
    removeLibrary(projectId, libraryId, user.id);
    return reply.status(204).send();
  });

  app.post("/projects/:projectId/libraries/:libraryId/documents/upload", async (request, reply) => {
    const user = await assertAuth(request);
    const { projectId, libraryId } = projectLibraryParamsSchema.parse(request.params);
    const upload = await readMultipartFile(request);
    const document = uploadLibraryDocument(
      projectId,
      libraryId,
      {
        filename: upload.filename,
        mimeType: upload.mimeType,
        buffer: upload.buffer,
        title: upload.title,
      },
      user.id,
    );
    return reply.status(201).send(document);
  });

  app.get("/library-documents/:documentId", async (request, reply) => {
    const user = await assertAuth(request);
    const { documentId } = documentIdParamsSchema.parse(request.params);
    const document = getLibraryDocument(documentId);
    if (!document) return reply.status(404).send({ error: "Document not found" });
    if (!getProjectById(document.projectId, user.id)) {
      return reply.status(404).send({ error: "Document not found" });
    }
    return document;
  });

  app.get("/library-documents/:documentId/content", async (request, reply) => {
    const user = await assertAuth(request);
    const { documentId } = documentIdParamsSchema.parse(request.params);
    const { document, buffer } = readLibraryDocumentContent(documentId);
    if (!getProjectById(document.projectId, user.id)) {
      return reply.status(404).send({ error: "Document not found" });
    }
    const downloadName = document.originalName || document.filename || document.title;
    reply.header("Content-Type", document.mimeType || "application/octet-stream");
    reply.header("Content-Length", buffer.byteLength);
    reply.header("X-Content-Hash", document.contentHash);
    reply.header("Content-Disposition", `attachment; filename="${downloadName.replace(/"/g, "")}"`);
    return reply.send(buffer);
  });

  app.put(
    "/projects/:projectId/libraries/:libraryId/documents/:documentId",
    async (request) => {
      const user = await assertAuth(request);
      const { projectId, libraryId, documentId } = projectLibraryDocumentParamsSchema.parse(
        request.params,
      );
      let rawBody = request.body;
      if (rawBody === null) {
        rawBody = {};
      }
      const body = renameDocumentSchema.parse(rawBody);
      return renameLibraryDocument(projectId, libraryId, documentId, body.title, user.id);
    },
  );

  app.post(
    "/projects/:projectId/libraries/:libraryId/documents/:documentId/upload",
    async (request) => {
      const user = await assertAuth(request);
      const { projectId, libraryId, documentId } = projectLibraryDocumentParamsSchema.parse(
        request.params,
      );
      const upload = await readMultipartFile(request);
      return replaceLibraryDocumentFile(projectId, libraryId, documentId, upload, user.id);
    },
  );

  app.delete(
    "/projects/:projectId/libraries/:libraryId/documents/:documentId",
    async (request, reply) => {
      const user = await assertAuth(request);
      const { projectId, libraryId, documentId } = projectLibraryDocumentParamsSchema.parse(
        request.params,
      );
      removeLibraryDocument(projectId, libraryId, documentId, user.id);
      return reply.status(204).send();
    },
  );

  app.post("/library-documents/:documentId/links", async (request, reply) => {
    const user = await assertAuth(request);
    const { documentId } = documentIdParamsSchema.parse(request.params);
    let rawBody = request.body;
    if (rawBody === null) {
      rawBody = {};
    }
    const body = linkDocumentSchema.parse(rawBody);
    const links = linkDocumentToTask(documentId, body.taskId, user.id);
    return reply.status(201).send({ items: links });
  });

  app.delete("/library-documents/:documentId/links/:taskId", async (request, reply) => {
    const user = await assertAuth(request);
    const { documentId } = documentIdParamsSchema.parse(request.params);
    const { taskId } = taskIdParamsSchema.parse(request.params);
    unlinkDocumentFromTask(documentId, taskId, user.id);
    return reply.status(204).send();
  });

  app.get("/tasks/:taskId/library-links", async (request) => {
    const user = await assertAuth(request);
    const { taskId } = taskIdParamsSchema.parse(request.params);
    return { items: listTaskLibraryLinks(taskId, user.id) };
  });
}
