import {
  deleteLibraryDocumentLink,
  deleteLibraryDocumentRow,
  deleteLibraryRow,
  extensionOf,
  hashBuffer,
  insertLibraryDocumentLink,
  insertLibraryDocumentRow,
  insertLibraryRow,
  listLibraryDocumentLinkRowsForDocument,
  listLibraryDocumentLinkRowsForTask,
  listLibraryDocumentRows,
  listLibraryRows,
  randomUUID,
  readDocumentFile,
  renameLibraryDocumentRow,
  sanitizeFilename,
  updateLibraryDocumentRow,
  updateLibraryRow,
  writeDocumentFile,
  type LibraryDocumentRow,
  type LibraryRow,
} from "../db/library-db.js";
import { listTaskRows } from "../db/tasks-db.js";
import { AppError } from "../errors/app-error.js";
import { getProjectById } from "./project-registry.js";

export type LibrarySummary = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  documentCount: number;
};

export type LibraryDocumentSummary = {
  id: string;
  libraryId: string;
  title: string;
  description: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  extension: string;
  updatedAt: string;
  hasFile: boolean;
};

export type LibraryDocument = LibraryDocumentSummary & {
  libraryTitle: string;
  projectId: string;
  linkCount: number;
};

export type LibraryDetail = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  documents: LibraryDocumentSummary[];
};

export type LibraryDocumentLink = {
  documentId: string;
  documentTitle: string;
  libraryId: string;
  libraryTitle: string;
  taskId: number;
  linkedAt: string;
};

export type LibrarySyncItem = {
  id: string;
  projectId: string;
  libraryId: string;
  libraryTitle: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  extension: string;
  updatedAt: string;
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "html",
  "htm",
  "csv",
  "json",
  "xml",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "log",
]);

function slugify(value: string) {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getLibraryRow(libraryId: string): LibraryRow | null {
  const rows = listLibraryRows({ id: libraryId, projectId: "" });
  return rows[0] ?? null;
}

function assertProject(projectId: string, ownerUserId?: string) {
  if (!getProjectById(projectId, ownerUserId)) {
    throw new AppError("Project not found", 404);
  }
}

function assertLibraryInProject(libraryId: string, projectId: string): LibraryRow {
  const row = getLibraryRow(libraryId);
  if (!row || row.project_id !== projectId) {
    throw new AppError("Library not found", 404);
  }
  return row;
}

function resolveLibraryId(inputId: string, title: string) {
  const custom = inputId;
  if (custom !== "") return custom;
  const base = slugify(title) || `library-${randomUUID()}`;
  let candidate = base;
  let suffix = 1;
  while (listLibraryRows({ id: candidate, projectId: "" }).length > 0) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function resolveDocumentId(inputId: string, title: string) {
  const custom = inputId;
  if (custom !== "") return custom;
  const base = slugify(title) || `doc-${randomUUID()}`;
  let candidate = base;
  let suffix = 1;
  while (listLibraryDocumentRows({ libraryId: "", documentId: candidate }).length > 0) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function mapDocumentSummary(row: LibraryDocumentRow): LibraryDocumentSummary {
  const filename = row.filename;
  return {
    id: row.id,
    libraryId: row.library_id,
    title: row.title,
    description: row.description,
    filename,
    originalName: row.original_name || filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    contentHash: row.content_hash,
    extension: extensionOf(row.original_name || filename),
    updatedAt: row.updated_at,
    hasFile: filename !== "" && row.content_hash !== "",
  };
}

function mapLibraryDocument(row: LibraryDocumentRow): LibraryDocument {
  const libraryRow = getLibraryRow(row.library_id);
  let libraryTitle = row.library_id;
  let projectId = "";
  if (libraryRow) {
    libraryTitle = libraryRow.title;
    projectId = libraryRow.project_id;
  }
  return Object.assign({}, mapDocumentSummary(row), {
    libraryTitle,
    projectId,
    linkCount: listLibraryDocumentLinkRowsForDocument(row.id).length,
  });
}

function mapLibraryDetail(row: LibraryRow): LibraryDetail {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    documents: listLibraryDocumentRows({ libraryId: row.id, documentId: "" }).map(mapDocumentSummary),
  };
}

function assertAllowedFilename(filename: string) {
  const ext = extensionOf(filename);
  if (ext === "" || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(`File type .${ext || "unknown"} is not allowed`, 400);
  }
}

export function listLibraries(projectId: string, ownerUserId: string): LibrarySummary[] {
  assertProject(projectId, ownerUserId);
  return listLibraryRows({ id: "", projectId }).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    documentCount: listLibraryDocumentRows({ libraryId: row.id, documentId: "" }).length,
  }));
}

export function getLibrary(
  projectId: string,
  libraryId: string,
  ownerUserId: string,
): LibraryDetail | null {
  assertProject(projectId, ownerUserId);
  const row = getLibraryRow(libraryId);
  if (!row || row.project_id !== projectId) return null;
  return mapLibraryDetail(row);
}

export function createLibrary(
  projectId: string,
  input: { id: string; title: string; description: string },
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  const title = input.title;
  if (title === "") throw new AppError("Title is required", 400);
  const id = resolveLibraryId(input.id, title);
  if (listLibraryRows({ id, projectId: "" }).length > 0) {
    throw new AppError("Library already exists", 409);
  }
  insertLibraryRow({ id, projectId, title, description: input.description });
  const created = getLibrary(projectId, id, ownerUserId);
  if (created === null) throw new AppError("Library creation failed", 500);
  return created;
}

export function updateLibrary(
  projectId: string,
  libraryId: string,
  input: { title: string; description: string },
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  const title = input.title;
  if (title === "") throw new AppError("Title is required", 400);
  updateLibraryRow(libraryId, { title, description: input.description });
  const updated = getLibrary(projectId, libraryId, ownerUserId);
  if (updated === null) throw new AppError("Library not found after update", 500);
  return updated;
}

export function removeLibrary(projectId: string, libraryId: string, ownerUserId: string) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  deleteLibraryRow(libraryId);
}

export function getLibraryDocument(documentId: string): LibraryDocument | null {
  const rows = listLibraryDocumentRows({ libraryId: "", documentId });
  const row = rows[0];
  if (!row) return null;
  return mapLibraryDocument(row);
}

export function uploadLibraryDocument(
  projectId: string,
  libraryId: string,
  input: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    title: string;
  },
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  if (input.buffer.byteLength === 0) throw new AppError("Empty file", 400);
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError("File too large (max 50MB)", 400);
  }
  const originalName = sanitizeFilename(input.filename);
  assertAllowedFilename(originalName);
  const title = input.title.trim() || originalName;
  const id = resolveDocumentId("", title);
  const filename = sanitizeFilename(originalName);
  const contentHash = hashBuffer(input.buffer);
  writeDocumentFile(libraryId, id, filename, input.buffer);
  insertLibraryDocumentRow({
    id,
    libraryId,
    title,
    description: "",
    filename,
    originalName,
    mimeType: input.mimeType || "application/octet-stream",
    sizeBytes: input.buffer.byteLength,
    contentHash,
  });
  const created = getLibraryDocument(id);
  if (created === null) throw new AppError("Document upload failed", 500);
  return created;
}

export function replaceLibraryDocumentFile(
  projectId: string,
  libraryId: string,
  documentId: string,
  input: { filename: string; mimeType: string; buffer: Buffer },
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  const rows = listLibraryDocumentRows({ libraryId: "", documentId });
  const row = rows[0];
  if (!row || row.library_id !== libraryId) throw new AppError("Document not found", 404);
  if (input.buffer.byteLength === 0) throw new AppError("Empty file", 400);
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError("File too large (max 50MB)", 400);
  }
  const originalName = sanitizeFilename(input.filename || row.original_name || row.title);
  assertAllowedFilename(originalName);
  const filename = sanitizeFilename(originalName);
  const contentHash = hashBuffer(input.buffer);
  writeDocumentFile(row.library_id, row.id, filename, input.buffer);
  updateLibraryDocumentRow(row.id, {
    title: row.title,
    description: row.description,
    filename,
    originalName,
    mimeType: input.mimeType || row.mime_type || "application/octet-stream",
    sizeBytes: input.buffer.byteLength,
    contentHash,
  });
  const updated = getLibraryDocument(row.id);
  if (updated === null) throw new AppError("Document not found after update", 500);
  return updated;
}

export function renameLibraryDocument(
  projectId: string,
  libraryId: string,
  documentId: string,
  title: string,
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  const trimmed = title.trim();
  if (trimmed === "") throw new AppError("Title is required", 400);
  const rows = listLibraryDocumentRows({ libraryId: "", documentId });
  const row = rows[0];
  if (!row || row.library_id !== libraryId) throw new AppError("Document not found", 404);
  renameLibraryDocumentRow(documentId, trimmed);
  const updated = getLibraryDocument(documentId);
  if (updated === null) throw new AppError("Document not found after rename", 500);
  return updated;
}

export function removeLibraryDocument(
  projectId: string,
  libraryId: string,
  documentId: string,
  ownerUserId: string,
) {
  assertProject(projectId, ownerUserId);
  assertLibraryInProject(libraryId, projectId);
  const rows = listLibraryDocumentRows({ libraryId: "", documentId });
  const row = rows[0];
  if (!row || row.library_id !== libraryId) throw new AppError("Document not found", 404);
  deleteLibraryDocumentRow(documentId);
}

export function readLibraryDocumentContent(documentId: string): {
  document: LibraryDocument;
  buffer: Buffer;
} {
  const rows = listLibraryDocumentRows({ libraryId: "", documentId });
  const row = rows[0];
  if (!row) throw new AppError("Document not found", 404);
  const document = mapLibraryDocument(row);
  if (!document.hasFile) throw new AppError("Document has no file", 404);
  const buffer = readDocumentFile(row.library_id, row.id, row.filename);
  if (buffer === null) throw new AppError("File missing on disk", 404);
  return { document, buffer };
}

export function listLibrarySyncManifest(
  projectId: string,
  libraryId: string,
  ownerUserId: string,
): LibrarySyncItem[] {
  assertProject(projectId, ownerUserId);
  let docs: LibraryDocumentRow[];
  if (libraryId !== "") {
    assertLibraryInProject(libraryId, projectId);
    docs = listLibraryDocumentRows({ libraryId, documentId: "" });
  } else {
    const libraries = listLibraryRows({ id: "", projectId });
    docs = [];
    for (const library of libraries) {
      docs = docs.concat(listLibraryDocumentRows({ libraryId: library.id, documentId: "" }));
    }
  }
  return docs
    .filter((row) => row.filename !== "" && row.content_hash !== "")
    .map((row) => {
      const libraryRow = getLibraryRow(row.library_id);
      let libraryTitle = row.library_id;
      let rowProjectId = projectId;
      if (libraryRow) {
        libraryTitle = libraryRow.title;
        rowProjectId = libraryRow.project_id;
      }
      return {
        id: row.id,
        projectId: rowProjectId,
        libraryId: row.library_id,
        libraryTitle,
        title: row.title,
        filename: row.filename,
        originalName: row.original_name || row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        contentHash: row.content_hash,
        extension: extensionOf(row.original_name || row.filename),
        updatedAt: row.updated_at,
      };
    });
}

export function linkDocumentToTask(documentId: string, taskId: number, ownerUserId: string) {
  const docs = listLibraryDocumentRows({ libraryId: "", documentId });
  const document = docs[0];
  if (!document) throw new AppError("Document not found", 404);
  const library = getLibraryRow(document.library_id);
  if (!library) throw new AppError("Library not found", 404);
  assertProject(library.project_id, ownerUserId);
  const tasks = listTaskRows({ id: taskId });
  if (tasks.length === 0) throw new AppError("Task not found", 404);
  const task = tasks[0];
  if (!task) throw new AppError("Task not found", 404);
  if (task.parentId !== null) {
    throw new AppError("Documents can only be linked to epics", 400);
  }
  if (task.projectId !== library.project_id) {
    throw new AppError("Document library belongs to a different project", 400);
  }
  insertLibraryDocumentLink(documentId, taskId);
  return listTaskLibraryLinks(taskId, ownerUserId);
}

export function unlinkDocumentFromTask(documentId: string, taskId: number, ownerUserId: string) {
  const docs = listLibraryDocumentRows({ libraryId: "", documentId });
  const document = docs[0];
  if (!document) throw new AppError("Document not found", 404);
  const library = getLibraryRow(document.library_id);
  if (!library) throw new AppError("Library not found", 404);
  assertProject(library.project_id, ownerUserId);
  deleteLibraryDocumentLink(documentId, taskId);
}

export function listTaskLibraryLinks(taskId: number, ownerUserId?: string): LibraryDocumentLink[] {
  const tasks = listTaskRows({ id: taskId });
  if (tasks.length === 0) return [];
  const task = tasks[0];
  if (!task) return [];
  if (ownerUserId !== undefined && ownerUserId !== "") {
    assertProject(task.projectId, ownerUserId);
  }
  return listLibraryDocumentLinkRowsForTask(taskId).flatMap((link) => {
    const docs = listLibraryDocumentRows({ libraryId: "", documentId: link.document_id });
    const document = docs[0];
    if (!document) return [];
    const library = getLibraryRow(document.library_id);
    let libraryTitle = document.library_id;
    if (library) libraryTitle = library.title;
    return [
      {
        documentId: document.id,
        documentTitle: document.title,
        libraryId: document.library_id,
        libraryTitle,
        taskId: link.task_id,
        linkedAt: link.created_at,
      },
    ];
  });
}
