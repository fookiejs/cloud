import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { BrandSplash } from "@/components/BrandSplash";
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
  return <BrandSplash title="Script Manager" subtitle="Opening task…" />;
}

function ScriptDashboardPage(props: { projectId: string }): React.JSX.Element {
  const { ready } = useBootstrap(props.projectId);
  if (!ready) {
    return <BrandSplash title="Script Manager" subtitle="Loading…" />;
  }
  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <DashboardView projectId={props.projectId} />
    </div>
  );
}

function ScriptWorkspacePage(props: { projectId: string; basePath: string }): React.JSX.Element {
  const params = useParams();
  const workspaceId = params["workspaceId"];
  const { ready } = useBootstrap(props.projectId);
  if (!ready) {
    return <BrandSplash title="Script Manager" subtitle="Loading…" />;
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
