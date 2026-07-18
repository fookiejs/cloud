import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
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

function ScriptLoadingShell(props: { title: string }): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-8 py-8">
      <header className="flex items-end justify-between gap-4 border-b pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  );
}

function TaskRedirect(props: { basePath: string }): React.JSX.Element {
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
  return <ScriptLoadingShell title="Scripts" />;
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
      return <div className="p-8 text-sm text-destructive">{error}</div>;
    }
    return <ScriptLoadingShell title="Scripts" />;
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
        <Route path="task/:taskId" element={<TaskRedirect basePath={basePath} />} />
        <Route path="workspace/:workspaceId" element={<Navigate to={basePath} replace />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </>
  );
}
