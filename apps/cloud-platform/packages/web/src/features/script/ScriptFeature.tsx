import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { BrandSplash } from "@/components/BrandSplash";
import { WaitingForAgent } from "@script/components/waiting-for-agent";
import { useAgentConnection } from "@script/hooks/use-agent-connection";
import { isCloudHost } from "@/lib/auth";
import { useBootstrap, useStore } from "@script/state/store";
import { DashboardView } from "@script/views/Dashboard";
import { WorkspaceView } from "@script/views/Workspace";
import { bindScriptNavigate, navigate } from "@script/navigate";

function ScriptNavigatorBinder(): null {
  const routerNavigate = useNavigate();
  useEffect(() => {
    bindScriptNavigate((to: string) => {
      routerNavigate(to);
    });
  }, [routerNavigate]);
  return null;
}

function TaskRedirect(): React.JSX.Element {
  const params = useParams();
  const taskId = params["taskId"];
  const tasksByWorkspace = useStore((s) => s.tasksByWorkspace);
  useEffect(() => {
    if (typeof taskId !== "string" || taskId.length === 0) {
      navigate("/script");
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
    navigate("/script");
  }, [taskId, tasksByWorkspace]);
  return <BrandSplash title="Script Manager" subtitle="Opening task…" />;
}

function ScriptDashboardPage(): React.JSX.Element {
  const { ready } = useBootstrap();
  if (!ready) {
    return <BrandSplash title="Script Manager" subtitle="Loading…" />;
  }
  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8">
      <DashboardView />
    </div>
  );
}

function ScriptWorkspacePage(): React.JSX.Element {
  const params = useParams();
  const workspaceId = params["workspaceId"];
  const { ready } = useBootstrap();
  if (!ready) {
    return <BrandSplash title="Script Manager" subtitle="Loading…" />;
  }
  if (typeof workspaceId !== "string" || workspaceId.length === 0) {
    return <Navigate to="/script" replace />;
  }
  return (
    <div className="w-full px-8 py-6">
      <WorkspaceView workspaceId={workspaceId} />
    </div>
  );
}

function ConnectedScriptRoutes(): React.JSX.Element {
  return (
    <>
      <ScriptNavigatorBinder />
      <Routes>
        <Route index element={<ScriptDashboardPage />} />
        <Route path="workspace/:workspaceId" element={<ScriptWorkspacePage />} />
        <Route path="task/:taskId" element={<TaskRedirect />} />
        <Route path="*" element={<Navigate to="/script" replace />} />
      </Routes>
    </>
  );
}

export function ScriptFeature(): React.JSX.Element {
  const agent = useAgentConnection();

  if (isCloudHost()) {
    if (agent.checking) {
      return <BrandSplash title="Script Manager" subtitle="Checking agent…" />;
    }
    if (!agent.online) {
      return <WaitingForAgent info={agent.info} />;
    }
    return <ConnectedScriptRoutes key="connected" />;
  }

  return <ConnectedScriptRoutes />;
}
