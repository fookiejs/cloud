import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Palette, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccessToken } from "@/lib/auth";

type DesignsPayload = {
  projectId: string;
  projectName: string;
  teamId: string | null;
  openUrl: string;
  provisioned: boolean;
  invited: boolean;
  message: string | null;
  publicUri: string;
};

async function fetchDesigns(projectId: string): Promise<DesignsPayload> {
  const headers = new Headers({ Accept: "application/json" });
  const token = getAccessToken();
  if (token !== null) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`/api/projects/${projectId}/designs`, { headers });
  const body = (await response.json().catch(() => ({}))) as DesignsPayload & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `http ${String(response.status)}`);
  }
  return body;
}

export function DesignsFeature(props: { projectId: string }): React.JSX.Element {
  const [payload, setPayload] = useState<DesignsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const next = await fetchDesigns(props.projectId);
      setPayload(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumb={[
          { label: "Projects", to: "/projects" },
          { label: props.projectId, to: `/projects/${props.projectId}/tasks` },
          { label: "Designs", to: null },
        ]}
        title="Designs"
        subtitle={
          loading
            ? "Loading Penpot workspace…"
            : payload !== null && payload.provisioned
              ? "Penpot team for this project"
              : "Open Penpot for this project"
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="mx-auto max-w-xl space-y-3">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        ) : error !== null ? (
          <div className="panel-card mx-auto max-w-xl space-y-4 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : payload !== null ? (
          <div className="panel-card mx-auto max-w-xl space-y-5 p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border bg-secondary/40">
                <Palette className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight">{payload.projectName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {payload.provisioned
                    ? "This Cloud project has its own Penpot team. Files stay isolated from other projects."
                    : "Penpot runs as one shared instance. Connect a service token to auto-create a team per project."}
                </p>
              </div>
            </div>

            {payload.message !== null ? (
              <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                {payload.message}
              </p>
            ) : null}

            {payload.teamId !== null ? (
              <p className="font-mono text-[11px] text-muted-foreground">Team {payload.teamId}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" asChild>
                <a href={payload.openUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open in Penpot
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={payload.publicUri} target="_blank" rel="noreferrer">
                  Penpot home
                </a>
              </Button>
            </div>

            {payload.invited ? (
              <p className="text-xs text-muted-foreground">
                An editor invite was sent to your account email for this team.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
