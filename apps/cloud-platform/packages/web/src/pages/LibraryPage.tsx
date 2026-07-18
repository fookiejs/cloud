import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Download,
  FileText,
  FolderPlus,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/useSession";
import {
  createLibrary,
  deleteLibrary,
  deleteLibraryDocument,
  downloadLibraryDocument,
  fetchLibraries,
  fetchLibrary,
  renameLibraryDocument,
  saveLibrary,
  uploadLibraryDocument,
  type LibraryDetail,
  type LibraryDocumentSummary,
  type LibrarySummary,
} from "@/lib/api";
import { cn, formatWhen } from "@/lib/utils";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryPage() {
  const { projectId = "" } = useParams();
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [libraries, setLibraries] = useState<LibrarySummary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState("");
  const [libraryDetail, setLibraryDetail] = useState<LibraryDetail | null>(null);
  const [libraryTitle, setLibraryTitle] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [extensionFilter, setExtensionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const docFromUrl = searchParams.get("doc") || "";

  const reloadLibraries = useCallback(async () => {
    if (!session || projectId === "") return [];
    const items = await fetchLibraries(session, projectId);
    setLibraries(items);
    return items;
  }, [session, projectId]);

  const loadLibrary = useCallback(
    async (libraryId: string) => {
      if (!session || projectId === "" || libraryId === "") return;
      const detail = await fetchLibrary(session, projectId, libraryId);
      setLibraryDetail(detail);
      setLibraryTitle(detail.title);
      setSelectedLibraryId(detail.id);
      return detail;
    },
    [session, projectId],
  );

  useEffect(() => {
    if (!session || projectId === "") return;
    const activeSession = session;
    let active = true;
    async function boot() {
      setLoading(true);
      try {
        const items = await reloadLibraries();
        if (!active) return;
        if (docFromUrl !== "") {
          for (const item of items) {
            const detail = await fetchLibrary(activeSession, projectId, item.id);
            if (!active) return;
            const found = detail.documents.find((doc) => doc.id === docFromUrl);
            if (found) {
              setLibraryDetail(detail);
              setLibraryTitle(detail.title);
              setSelectedLibraryId(detail.id);
              setSelectedDocumentId(found.id);
              return;
            }
          }
        }
        if (items[0]) {
          await loadLibrary(items[0].id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load library");
      } finally {
        if (active) setLoading(false);
      }
    }
    void boot();
    return () => {
      active = false;
    };
  }, [session, projectId, docFromUrl, reloadLibraries, loadLibrary]);

  const documents = useMemo(() => {
    const docs = libraryDetail !== null ? libraryDetail.documents : [];
    if (extensionFilter === "") return docs;
    return docs.filter((doc) => doc.extension === extensionFilter);
  }, [libraryDetail, extensionFilter]);

  const extensions = useMemo(() => {
    const docs = libraryDetail !== null ? libraryDetail.documents : [];
    const set = new Set<string>();
    for (const doc of docs) {
      if (doc.extension !== "") set.add(doc.extension);
    }
    return Array.from(set).sort();
  }, [libraryDetail]);

  async function handleCreateFolder() {
    if (!session || projectId === "") return;
    try {
      const created = await createLibrary(session, projectId, {
        title: "New folder",
        id: "",
        description: "",
      });
      await reloadLibraries();
      await loadLibrary(created.id);
      toast.success("Folder created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder");
    }
  }

  async function handleSaveFolder() {
    if (!session || projectId === "" || selectedLibraryId === "") return;
    try {
      await saveLibrary(session, projectId, selectedLibraryId, {
        title: libraryTitle.trim() || "Untitled folder",
        description: "",
      });
      await reloadLibraries();
      toast.success("Folder renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save folder");
    }
  }

  async function handleDeleteFolder() {
    if (!session || projectId === "" || selectedLibraryId === "") return;
    if (!window.confirm("Delete this folder and all files?")) return;
    try {
      await deleteLibrary(session, projectId, selectedLibraryId);
      setLibraryDetail(null);
      setSelectedLibraryId("");
      setSelectedDocumentId("");
      const items = await reloadLibraries();
      if (items[0]) await loadLibrary(items[0].id);
      toast.success("Folder deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder");
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!session || projectId === "" || selectedLibraryId === "") {
      toast.error("Select a folder first");
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        await uploadLibraryDocument(session, projectId, selectedLibraryId, file);
      }
      await loadLibrary(selectedLibraryId);
      await reloadLibraries();
      toast.success(list.length === 1 ? "File uploaded" : `${list.length} files uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: LibraryDocumentSummary) {
    if (!session) return;
    try {
      const blob = await downloadLibraryDocument(session, doc.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.originalName || doc.filename || doc.title;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }

  async function handleRename(doc: LibraryDocumentSummary) {
    if (!session || projectId === "" || selectedLibraryId === "") return;
    const next = renameValue.trim();
    if (next === "") return;
    try {
      await renameLibraryDocument(session, projectId, selectedLibraryId, doc.id, next);
      setRenamingId("");
      await loadLibrary(selectedLibraryId);
      toast.success("Renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rename failed");
    }
  }

  async function handleDeleteDoc(doc: LibraryDocumentSummary) {
    if (!session || projectId === "" || selectedLibraryId === "") return;
    if (!window.confirm(`Delete ${doc.title}?`)) return;
    try {
      await deleteLibraryDocument(session, projectId, selectedLibraryId, doc.id);
      if (selectedDocumentId === doc.id) {
        setSelectedDocumentId("");
        setSearchParams({});
      }
      await loadLibrary(selectedLibraryId);
      await reloadLibraries();
      toast.success("Deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  if (projectId === "") {
    return <p className="text-sm text-muted-foreground">Open a project to use Library.</p>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Library"
        subtitle="Project files — upload, download, sync via API"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void handleCreateFolder()}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New folder
            </Button>
            <Button
              type="button"
              disabled={selectedLibraryId === "" || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        }
      />

      <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-white/[0.06] bg-[#0c0c0c] p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Folders
          </p>
          <div className="space-y-1">
            {libraries.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => void loadLibrary(folder.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                  selectedLibraryId === folder.id
                    ? "bg-primary/15 text-white"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <span className="truncate">{folder.title}</span>
                <span className="text-xs opacity-60">{folder.documentCount}</span>
              </button>
            ))}
            {libraries.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground">No folders yet.</p>
            ) : null}
          </div>
        </aside>

        <section className="flex flex-col rounded-xl border border-white/[0.06] bg-[#0c0c0c]">
          {selectedLibraryId === "" || libraryDetail === null ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Create or select a folder to manage files.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                <Input
                  value={libraryTitle}
                  onChange={(event) => setLibraryTitle(event.target.value)}
                  onBlur={() => void handleSaveFolder()}
                  className="max-w-xs"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleDeleteFolder()}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="ml-auto flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setExtensionFilter("")}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs",
                      extensionFilter === ""
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:bg-white/[0.04]",
                    )}
                  >
                    All
                  </button>
                  {extensions.map((ext) => (
                    <button
                      key={ext}
                      type="button"
                      onClick={() => setExtensionFilter(ext)}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs uppercase",
                        extensionFilter === ext
                          ? "bg-white/10 text-white"
                          : "text-muted-foreground hover:bg-white/[0.04]",
                      )}
                    >
                      .{ext}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={cn(
                  "m-4 flex flex-1 flex-col rounded-xl border border-dashed p-4 transition-colors",
                  dragging
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] bg-[#080808]",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (event.dataTransfer.files.length > 0) {
                    void uploadFiles(event.dataTransfer.files);
                  }
                }}
              >
                {documents.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-white">Drop files here</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, TXT, HTML, images, Office docs — or use Upload
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {documents.map((doc) => {
                      const selected = selectedDocumentId === doc.id;
                      const renaming = renamingId === doc.id;
                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2",
                            selected ? "bg-primary/10" : "hover:bg-white/[0.03]",
                          )}
                          onClick={() => {
                            setSelectedDocumentId(doc.id);
                            setSearchParams({ doc: doc.id });
                          }}
                        >
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            {renaming ? (
                              <Input
                                value={renameValue}
                                autoFocus
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onBlur={() => void handleRename(doc)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void handleRename(doc);
                                  if (event.key === "Escape") setRenamingId("");
                                }}
                                className="h-8"
                              />
                            ) : (
                              <>
                                <p className="truncate text-sm text-white">{doc.title}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {doc.originalName || doc.filename}
                                  {doc.extension !== "" ? ` · .${doc.extension}` : ""}
                                  {doc.hasFile ? ` · ${formatBytes(doc.sizeBytes)}` : " · no file"}
                                  {` · ${formatWhen(doc.updatedAt)}`}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={!doc.hasFile}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDownload(doc);
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRenamingId(doc.id);
                                setRenameValue(doc.title);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDeleteDoc(doc);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
