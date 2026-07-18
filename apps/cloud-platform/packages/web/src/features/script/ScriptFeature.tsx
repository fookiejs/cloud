import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap, useStore } from "@script/state/store";
import { DashboardView } from "@script/views/Dashboard";
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
          navigate(`/workspace/${task.workspace_id}`);
          return;
        }
      }
    }
    navigate(props.basePath);
  }, [taskId, tasksByWorkspace, props.basePath]);
  return <ScriptLoadingShell title="Script workspaces" />;
}

function ScriptDashboardPage(props: { projectId: string }): React.JSX.Element {
  const { ready } = useBootstrap(props.projectId);
  if (!ready) {
    return <ScriptLoadingShell title="Script workspaces" />;
  }
  return (
    <div className="mx-auto max-w-[1600px] px-8 py-8">
      <DashboardView projectId={props.projectId} />
    </div>
  );
}

function ScriptWorkspacePage(props: { projectId: string; basePath: string }): React.JSX.Element {
  const params = useParams();
  const workspaceId = params["workspaceId"];
  const { ready } = useBootstrap(props.projectId);
  if (!ready) {
    return <ScriptLoadingShell title="Workspace" />;
  }
  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return <Navigate to={props.basePath} replace />;
  }
  return (
    <div className="w-full px-8 py-6">
      <WorkspaceView workspaceId={workspaceId} />
    </div>
  );
}

export function ScriptFeature(props: { projectId: string }): React.JSX.Element {
  const basePath = `/projects/${props.projectId}/scripts`;
  return (
    <>
      <ScriptNavigatorBinder basePath={basePath} />
      <Routes>
        <Route index element={<ScriptDashboardPage projectId={props.projectId} />} />
        <Route
          path="workspace/:workspaceId"
          element={<ScriptWorkspacePage projectId={props.projectId} basePath={basePath} />}
        />
        <Route path="task/:taskId" element={<TaskRedirect basePath={basePath} />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </>
  );
}
