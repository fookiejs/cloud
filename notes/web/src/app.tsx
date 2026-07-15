import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAccessToken, isCloudHost } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NoteListItem = {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  seenAt: string | null;
  seen: boolean;
};

type Note = NoteListItem & { body: string };

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
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `http ${res.status}`);
  return data;
}

export function App(): React.JSX.Element {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isCloudHost() && !getAccessToken()) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await api<{ notes: NoteListItem[] }>("/api/notes");
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = notes.filter((n) => !n.seen).length;

  async function openNote(id: string): Promise<void> {
    setError(null);
    try {
      const note = await api<Note>(`/api/notes/${id}`);
      setSelected(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "open failed");
    }
  }

  async function toggleSeen(): Promise<void> {
    if (!selected) return;
    const seen = !selected.seenAt;
    try {
      const updated = await api<Note>(`/api/notes/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seen }),
      });
      setSelected(updated);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === updated.id
            ? { ...n, seen: Boolean(updated.seenAt), seenAt: updated.seenAt }
            : n,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "update failed");
    }
  }

  return (
    <div className="min-h-screen">
      <Sidebar unread={unread} />
      <main className="pl-60 min-h-screen">
        <div className="px-6 py-5 border-b flex items-center gap-3 h-14">
          {selected ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="secondary" size="sm" onClick={() => void toggleSeen()}>
                <Check className="w-4 h-4" />
                {selected.seenAt ? "Mark unread" : "Mark seen"}
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-sm font-semibold tracking-tight">Inbox</h1>
              {unread > 0 ? <Badge variant="warn">{unread} unread</Badge> : null}
            </>
          )}
        </div>

        <div className="p-6">
          {error ? <p className="text-sm text-destructive mb-4">{error}</p> : null}

          {selected ? (
            <article className="max-w-3xl rounded-lg border bg-card/40 p-5">
              <h2 className="text-lg font-semibold tracking-tight mb-1">{selected.title}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {selected.source || "note"} · {fmt(selected.createdAt)}
                {selected.seenAt ? ` · seen ${fmt(selected.seenAt)}` : ""}
              </p>
              <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-sans text-foreground/90">
                {selected.body}
              </pre>
            </article>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-w-3xl">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void openNote(n.id)}
                    className={cn(
                      "w-full text-left rounded-md border px-3.5 py-3 transition-colors",
                      "hover:bg-secondary/60",
                      n.seen ? "border-transparent bg-transparent" : "border-border bg-card/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                          n.seen ? "bg-transparent" : "bg-warn",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {n.source || "note"} · {fmt(n.createdAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
