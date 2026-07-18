import { Check, Server, Unplug } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAgentConnection } from "@script/hooks/use-agent-connection";
import { clearProjectWorkspaceId, loadProjectWorkspaceId, saveProjectWorkspaceId } from "@script/lib/project-node";
import { useBootstrap, useStore } from "@script/state/store";

function ConnectedNode(props: { projectId: string; hostname: string }): React.JSX.Element {
  const { ready } = useBootstrap();
  const workspaces = useStore((state) => state.workspaces);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | false>(() =>
    loadProjectWorkspaceId(props.projectId),
  );

  return (
    <div className="space-y-5">
      <section className="panel-card flex items-center justify-between gap-5 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Server className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{props.hostname}</p>
            <p className="text-xs text-emerald-400">Connected</p>
          </div>
        </div>
        {selectedWorkspaceId !== false ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearProjectWorkspaceId(props.projectId);
              setSelectedWorkspaceId(false);
            }}
          >
            Disconnect from project
          </Button>
        ) : null}
      </section>

      <section className="panel-card p-5">
        <h2 className="text-sm font-semibold text-white">Project workspace</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose the folder on this node where project scripts run.
        </p>
        <div className="mt-4 grid gap-2">
          {!ready ? <p className="text-sm text-muted-foreground">Reading node workspaces…</p> : null}
          {ready && workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This node has no workspace yet. Create one in the local Script Manager.
            </p>
          ) : null}
          {workspaces.map((workspace) => {
            const selected = selectedWorkspaceId === workspace.id;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => {
                  saveProjectWorkspaceId(props.projectId, workspace.id);
                  setSelectedWorkspaceId(workspace.id);
                }}
                className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-secondary/50"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
                  {selected ? <Check className="h-4 w-4 text-emerald-400" /> : <Server className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{workspace.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{workspace.path}</span>
                </span>
              </button>
            );
          })}
        </div>
        {selectedWorkspaceId !== false ? (
          <Button className="mt-5" asChild>
            <Link to={`/projects/${props.projectId}/scripts`}>Open scripts</Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}

export function ProjectNodesPage(): React.JSX.Element {
  const { projectId } = useParams();
  const agent = useAgentConnection();
  const activeProjectId = projectId ?? "";
  const hostname = agent.info?.hostname ?? "Connected node";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Nodes" subtitle="Machines connected to this project" />
      <div className="flex-1 overflow-y-auto p-6">
        {agent.checking ? <p className="text-sm text-muted-foreground">Checking node connection…</p> : null}
        {!agent.checking && !agent.online ? (
          <div className="panel-card mx-auto max-w-xl p-6">
            <Unplug className="h-7 w-7 text-muted-foreground" />
            <h2 className="mt-5 text-base font-semibold text-white">No node connected</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Run <code className="rounded bg-secondary px-1.5 py-0.5">npx -y @fookiejs/script@latest</code> on a machine and sign in.
            </p>
          </div>
        ) : null}
        {!agent.checking && agent.online ? (
          <ConnectedNode projectId={activeProjectId} hostname={hostname} />
        ) : null}
      </div>
    </div>
  );
}
