import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/useSession";
import {
  createApiKey,
  fetchApiKeys,
  revokeApiKey,
  type ApiKeySummary,
} from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  "read-write": "Read & Write",
  read: "Read only",
};

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfilePage() {
  const session = useSession();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("CLI / automation");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setKeys(await fetchApiKeys(session));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!session) return null;

  let roleLabel: string = session.userRole;
  if (session.userRole in ROLE_LABELS) {
    const label = ROLE_LABELS[session.userRole];
    if (typeof label === "string") roleLabel = label;
  }

  async function handleCreate() {
    if (!session) return;
    setCreating(true);
    try {
      const result = await createApiKey(session, keyName.trim() || "API key");
      setRevealedKey(result.rawKey);
      setCreateOpen(false);
      setKeyName("CLI / automation");
      setKeys((prev) => [result.key].concat(prev));
      toast.success("API key created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(key: ApiKeySummary) {
    if (!session) return;
    if (!confirm(`Revoke “${key.name}”?`)) return;
    setRevokingId(key.id);
    try {
      await revokeApiKey(session, key.id);
      setKeys((prev) => prev.filter((item) => item.id !== key.id));
      toast.success("API key revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Profile" />

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section className="panel-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-lg font-semibold uppercase text-primary">
              {session.userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">{session.userName}</h2>
              <p className="truncate text-sm text-muted-foreground">{session.userEmail}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{roleLabel}</Badge>
                {session.isSystemAdmin ? <Badge>System admin</Badge> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="panel-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4 text-primary" />
              API keys
            </h2>
            <Button
              size="sm"
              onClick={() => {
                setRevealedKey(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Create key
            </Button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading keys…
              </div>
            ) : keys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">No API keys yet</p>
                <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create key
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {keys.map((key) => (
                  <li
                    key={key.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{key.name}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Created {formatWhen(key.createdAt)} · Last used {formatWhen(key.lastUsedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokingId === key.id}
                      onClick={() => void handleRevoke(key)}
                    >
                      {revokingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g. Local agent"
              disabled={creating}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={creating || keyName.trim().length === 0} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 py-2">
            <Input readOnly value={revealedKey ?? ""} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => void copyKey()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedKey(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
