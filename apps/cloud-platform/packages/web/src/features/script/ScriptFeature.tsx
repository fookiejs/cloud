import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@script/api/client";
import { actions, useBootstrap, useStore } from "@script/state/store";
import { WorkspaceView } from "@script/views/Workspace";
import { bindScriptNavigate, navigate } from "@script/navigate";

function ScriptNavigatorBinder(props: { basePath: string }): null {
  const routerNavigate = useNavigate();
  useEffect(() => {
    bindScriptNavigate((to: string) => {
      routerNavigate(to);
    }, props.basePath);
  }, [props.basePath, routerNavigate]);
  return null;
}

function ScriptBodySkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}

function ScriptPageShell(props: {
  projectName: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8">
      <PageHeader title="Scripts" subtitle={props.projectName} />
      {props.children}
    </div>
  );
}

function TaskRedirect(props: { basePath: string; projectName: string }): React.JSX.Element {
  const params = useParams();
  const taskId = params["taskId"];
  const tasksByWorkspace = useStore((s) => s.tasksByWorkspace);
  useEffect(() => {
    if (typeof taskId !== "string" || taskId.length === 0) {
      navigate(props.basePath);
      return;
    }
    for (const key of Object.keys(tasksByWorkspace)) {
      const list = tasksByWorkspace[key];
      if (list === undefined) {
        continue;
      }
      for (const task of list) {
        if (task.id === taskId) {
          navigate(props.basePath);
          return;
        }
      }
    }
    navigate(props.basePath);
  }, [taskId, tasksByWorkspace, props.basePath]);
  return (
    <ScriptPageShell projectName={props.projectName}>
      <ScriptBodySkeleton />
    </ScriptPageShell>
  );
}

function ScriptProjectPage(props: {
  projectId: string;
  projectName: string;
}): React.JSX.Element {
  const { ready } = useBootstrap(props.projectId);
  const workspaces = useStore((state) => state.workspaces);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || ensuring || workspaces.length > 0) {
      return;
    }
    setEnsuring(true);
    setError(null);
    void api
      .ensureProjectWorkspace(props.projectId, props.projectName)
      .then(async () => {
        await actions.refreshWorkspaces();
      })
      .catch((failure: Error) => {
        setError(failure.message);
      })
      .finally(() => {
        setEnsuring(false);
      });
  }, [ensuring, props.projectId, props.projectName, ready, workspaces.length]);
  const workspace = workspaces[0];
  if (!ready || ensuring || workspace === undefined) {
    if (error !== null) {
      return (
        <ScriptPageShell projectName={props.projectName}>
          <div className="p-8 text-sm text-destructive">{error}</div>
        </ScriptPageShell>
      );
    }
    return (
      <ScriptPageShell projectName={props.projectName}>
        <ScriptBodySkeleton />
      </ScriptPageShell>
    );
  }
  return (
    <div className="w-full px-8 py-6">
      <WorkspaceView workspaceId={workspace.id} projectName={props.projectName} />
    </div>
  );
}

export function ScriptFeature(props: {
  projectId: string;
  projectName: string;
}): React.JSX.Element {
  const basePath = `/projects/${props.projectId}/scripts`;
  return (
    <>
      <ScriptNavigatorBinder basePath={basePath} />
      <Routes>
        <Route
          index
          element={
            <ScriptProjectPage projectId={props.projectId} projectName={props.projectName} />
          }
        />
        <Route
          path="task/:taskId"
          element={<TaskRedirect basePath={basePath} projectName={props.projectName} />}
        />
        <Route path="workspace/:workspaceId" element={<Navigate to={basePath} replace />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </>
  );
}
