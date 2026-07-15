import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { getProjectsDb } from "./projects-db.js";

export type LibraryRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  updated_at: string;
};

export type LibraryDocumentRow = {
  id: string;
  library_id: string;
  title: string;
  description: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  updated_at: string;
};

export type LibraryDocumentLinkRow = {
  document_id: string;
  task_id: number;
  created_at: string;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

function columnExists(table: string, column: string): boolean {
  const rows = getProjectsDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function migrateLibraryTables() {
  const db = getProjectsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS library_documents (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_library_documents_library_id ON library_documents(library_id);
    CREATE TABLE IF NOT EXISTS library_document_links (
      document_id TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (document_id, task_id),
      FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_library_document_links_task_id ON library_document_links(task_id);
  `);

  if (!columnExists("library_documents", "filename")) {
    db.exec("ALTER TABLE library_documents ADD COLUMN filename TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists("library_documents", "original_name")) {
    db.exec("ALTER TABLE library_documents ADD COLUMN original_name TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists("library_documents", "mime_type")) {
    db.exec(
      "ALTER TABLE library_documents ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'application/octet-stream'",
    );
  }
  if (!columnExists("library_documents", "size_bytes")) {
    db.exec("ALTER TABLE library_documents ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists("library_documents", "content_hash")) {
    db.exec("ALTER TABLE library_documents ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists("libraries", "project_id")) {
    db.exec("ALTER TABLE libraries ADD COLUMN project_id TEXT NOT NULL DEFAULT ''");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_libraries_project_id ON libraries(project_id)");

  const orphaned = db
    .prepare(`SELECT COUNT(*) AS count FROM libraries WHERE trim(project_id) = ''`)
    .get() as { count: number };
  if (orphaned.count > 0) {
    db.prepare(`DELETE FROM libraries WHERE trim(project_id) = ''`).run();
  }
}

function ensureMigrated() {
  migrateLibraryTables();
}

export function resolveLibraryFilesRoot(): string {
  if (config.databasePath) {
    return join(dirname(config.databasePath), "library-files");
  }
  return join(moduleDir, "..", "..", "..", "..", "data", "library-files");
}

export function documentStoragePath(libraryId: string, documentId: string, filename: string): string {
  return join(resolveLibraryFilesRoot(), libraryId, documentId, filename);
}

export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "-").trim();
  if (base === "") return `file-${randomUUID().slice(0, 8)}`;
  return base.slice(0, 180);
}

export function extensionOf(filename: string): string {
  return extname(filename).replace(".", "").toLowerCase();
}

export function writeDocumentFile(
  libraryId: string,
  documentId: string,
  filename: string,
  buffer: Buffer,
): string {
  const path = documentStoragePath(libraryId, documentId, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  return path;
}

export function readDocumentFile(
  libraryId: string,
  documentId: string,
  filename: string,
): Buffer | null {
  if (filename === "") return null;
  const path = documentStoragePath(libraryId, documentId, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function deleteDocumentFiles(libraryId: string, documentId: string) {
  const dir = join(resolveLibraryFilesRoot(), libraryId, documentId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function deleteLibraryFiles(libraryId: string) {
  const dir = join(resolveLibraryFilesRoot(), libraryId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function listLibraryRows(filter: { id: string; projectId: string }): LibraryRow[] {
  ensureMigrated();
  const id = filter.id;
  const projectId = filter.projectId;
  if (id !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, title, description, updated_at FROM libraries WHERE id = ?`,
      )
      .all(id) as LibraryRow[];
  }
  if (projectId !== "") {
    return getProjectsDb()
      .prepare(
        `SELECT id, project_id, title, description, updated_at FROM libraries WHERE project_id = ? ORDER BY title COLLATE NOCASE ASC`,
      )
      .all(projectId) as LibraryRow[];
  }
  return getProjectsDb()
    .prepare(
      `SELECT id, project_id, title, description, updated_at FROM libraries ORDER BY title COLLATE NOCASE ASC`,
    )
    .all() as LibraryRow[];
}

export function insertLibraryRow(row: {
  id: string;
  projectId: string;
  title: string;
  description: string;
}) {
  ensureMigrated();
  getProjectsDb()
    .prepare(
      `INSERT INTO libraries (id, project_id, title, description, updated_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    )
    .run(row.id, row.projectId, row.title, row.description);
}

export function updateLibraryRow(id: string, patch: { title: string; description: string }) {
  ensureMigrated();
  getProjectsDb()
    .prepare(
      `UPDATE libraries SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(patch.title, patch.description, id);
}

export function deleteLibraryRow(id: string) {
  ensureMigrated();
  const db = getProjectsDb();
  db.prepare(
    `DELETE FROM library_document_links WHERE document_id IN (SELECT id FROM library_documents WHERE library_id = ?)`,
  ).run(id);
  db.prepare(`DELETE FROM library_documents WHERE library_id = ?`).run(id);
  db.prepare(`DELETE FROM libraries WHERE id = ?`).run(id);
  deleteLibraryFiles(id);
}

export function listLibraryDocumentRows(filter: {
  libraryId: string;
  documentId: string;
}): LibraryDocumentRow[] {
  ensureMigrated();
  const documentId = filter.documentId;
  const libraryId = filter.libraryId;
  const select = `SELECT id, library_id, title, description, filename, original_name, mime_type, size_bytes, content_hash, updated_at FROM library_documents`;
  if (documentId !== "") {
    return getProjectsDb().prepare(`${select} WHERE id = ?`).all(documentId) as LibraryDocumentRow[];
  }
  if (libraryId !== "") {
    return getProjectsDb()
      .prepare(`${select} WHERE library_id = ? ORDER BY title COLLATE NOCASE ASC`)
      .all(libraryId) as LibraryDocumentRow[];
  }
  return getProjectsDb()
    .prepare(`${select} ORDER BY title COLLATE NOCASE ASC`)
    .all() as LibraryDocumentRow[];
}

export function insertLibraryDocumentRow(row: {
  id: string;
  libraryId: string;
  title: string;
  description: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
}) {
  ensureMigrated();
  getProjectsDb()
    .prepare(
      `INSERT INTO library_documents
        (id, library_id, title, description, filename, original_name, mime_type, size_bytes, content_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      row.id,
      row.libraryId,
      row.title,
      row.description,
      row.filename,
      row.originalName,
      row.mimeType,
      row.sizeBytes,
      row.contentHash,
    );
}

export function updateLibraryDocumentRow(
  id: string,
  patch: {
    title: string;
    description: string;
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    contentHash: string;
  },
) {
  ensureMigrated();
  getProjectsDb()
    .prepare(
      `UPDATE library_documents
       SET title = ?, description = ?, filename = ?, original_name = ?, mime_type = ?, size_bytes = ?, content_hash = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      patch.title,
      patch.description,
      patch.filename,
      patch.originalName,
      patch.mimeType,
      patch.sizeBytes,
      patch.contentHash,
      id,
    );
}

export function renameLibraryDocumentRow(id: string, title: string) {
  ensureMigrated();
  getProjectsDb()
    .prepare(`UPDATE library_documents SET title = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(title, id);
}

export function deleteLibraryDocumentRow(id: string) {
  ensureMigrated();
  const rows = listLibraryDocumentRows({ libraryId: "", documentId: id });
  const row = rows[0];
  const db = getProjectsDb();
  db.prepare(`DELETE FROM library_document_links WHERE document_id = ?`).run(id);
  db.prepare(`DELETE FROM library_documents WHERE id = ?`).run(id);
  if (row) {
    deleteDocumentFiles(row.library_id, row.id);
  }
}

export function insertLibraryDocumentLink(documentId: string, taskId: number) {
  ensureMigrated();
  getProjectsDb()
    .prepare(
      `INSERT OR IGNORE INTO library_document_links (document_id, task_id, created_at) VALUES (?, ?, datetime('now'))`,
    )
    .run(documentId, taskId);
}

export function deleteLibraryDocumentLink(documentId: string, taskId: number) {
  ensureMigrated();
  getProjectsDb()
    .prepare(`DELETE FROM library_document_links WHERE document_id = ? AND task_id = ?`)
    .run(documentId, taskId);
}

export function listLibraryDocumentLinkRowsForTask(taskId: number): LibraryDocumentLinkRow[] {
  ensureMigrated();
  return getProjectsDb()
    .prepare(
      `SELECT document_id, task_id, created_at FROM library_document_links WHERE task_id = ? ORDER BY created_at ASC`,
    )
    .all(taskId) as LibraryDocumentLinkRow[];
}

export function listLibraryDocumentLinkRowsForDocument(documentId: string): LibraryDocumentLinkRow[] {
  ensureMigrated();
  return getProjectsDb()
    .prepare(
      `SELECT document_id, task_id, created_at FROM library_document_links WHERE document_id = ? ORDER BY created_at ASC`,
    )
    .all(documentId) as LibraryDocumentLinkRow[];
}

export { randomUUID };
