import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NoteListItem = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  seenAt: string | null;
  seen: boolean;
};

type Note = NoteListItem & { body: string; projectId: string };

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `http ${res.status}`);
  }
  return data;
}

function notesBase(projectId: string): string {
  return `/projects/${projectId}/notes`;
}

function NotesListPage(props: { projectId: string }): React.JSX.Element {
  const navigate = useNavigate();
  const base = notesBase(props.projectId);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = new URLSearchParams({ projectId: props.projectId });
      const data = await api<{ notes: NoteListItem[] }>(`/api/notes?${query.toString()}`);
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = notes.filter((n) => !n.seen).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-6 py-5">
        <h1 className="text-sm font-semibold tracking-tight">Notes</h1>
        {unread > 0 ? <Badge variant="warn">{unread} unread</Badge> : null}
        <div className="flex-1" />
        <Button type="button" size="sm" onClick={() => navigate(`${base}/new`)}>
          <Plus className="h-4 w-4" />
          New note
        </Button>
      </div>
      <div className="p-6">
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <ul className="flex max-w-3xl flex-col gap-1">
            <li>
              <Skeleton className="h-[4.25rem] w-full rounded-md" />
            </li>
            <li>
              <Skeleton className="h-[4.25rem] w-full rounded-md" />
            </li>
            <li>
              <Skeleton className="h-[4.25rem] w-full rounded-md" />
            </li>
          </ul>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex max-w-3xl flex-col gap-1">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  to={`${base}/${n.id}`}
                  className={cn(
                    "block w-full rounded-md border px-3.5 py-3 text-left transition-colors",
                    "hover:bg-secondary/60",
                    n.seen ? "border-transparent bg-transparent" : "border-border bg-card/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        n.seen ? "bg-transparent" : "bg-warn",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {n.source || "note"} · {fmt(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotesDetailPage(props: { projectId: string }): React.JSX.Element {
  const params = useParams();
  const noteId = params["noteId"];
  const navigate = useNavigate();
  const base = notesBase(props.projectId);
  const [selected, setSelected] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof noteId !== "string" || noteId.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const note = await api<Note>(`/api/notes/${noteId}`);
        if (!cancelled) {
          setSelected(note);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "open failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  async function toggleSeen(): Promise<void> {
    if (!selected) {
      return;
    }
    const seen = !selected.seenAt;
    try {
      const updated = await api<Note>(`/api/notes/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seen }),
      });
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "update failed");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-6 py-5">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(base)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1" />
        {selected ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void toggleSeen()}>
            <Check className="h-4 w-4" />
            {selected.seenAt ? "Mark unread" : "Mark seen"}
          </Button>
        ) : null}
      </div>
      <div className="p-6">
        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
        {selected ? (
          <article className="max-w-3xl rounded-lg border bg-card/40 p-5">
            <h2 className="mb-1 text-lg font-semibold tracking-tight">{selected.title}</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {selected.source || "note"} · {fmt(selected.createdAt)}
              {selected.seenAt ? ` · seen ${fmt(selected.seenAt)}` : ""}
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
              {selected.body}
            </pre>
          </article>
        ) : error ? null : (
          <div className="max-w-3xl space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

function NotesCreatePage(props: { projectId: string }): React.JSX.Element {
  const navigate = useNavigate();
  const base = notesBase(props.projectId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const note = await api<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify({ title, body, source: "manual", projectId: props.projectId }),
      });
      navigate(`${base}/${note.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "create failed");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 items-center gap-3 border-b px-6 py-5">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(base)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-sm font-semibold tracking-tight">New note</h1>
      </div>
      <form className="max-w-3xl space-y-4 p-6" onSubmit={(e) => void onSubmit(e)}>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
        />
        <textarea
          className="min-h-[240px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
          required
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create"}
        </Button>
      </form>
    </div>
  );
}

export function NotesFeature(props: { projectId: string }): React.JSX.Element {
  const base = notesBase(props.projectId);
  return (
    <Routes>
      <Route index element={<NotesListPage projectId={props.projectId} />} />
      <Route path="new" element={<NotesCreatePage projectId={props.projectId} />} />
      <Route path=":noteId" element={<NotesDetailPage projectId={props.projectId} />} />
      <Route path="*" element={<Navigate to={base} replace />} />
    </Routes>
  );
}
