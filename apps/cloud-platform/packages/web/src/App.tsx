import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { InboxPage } from "@/pages/InboxPage";
import { LoginPage } from "@/pages/LoginPage";
import { CallbackPage } from "@/pages/CallbackPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { MobilePage } from "@/pages/MobilePage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { TasksPage } from "@/pages/TasksPage";
import { TaskPage } from "@/pages/TaskPage";
import { WorkflowPage } from "@/pages/WorkflowPage";
import { WorkflowTemplatesPage } from "@/pages/WorkflowTemplatesPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { MarketplacePage } from "@/pages/MarketplacePage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ScriptFeature } from "@/features/script/ScriptFeature";
import { NotesFeature } from "@/features/notes/NotesFeature";
import { loadSession } from "@/lib/session";
import { ProjectOverviewPage } from "@/pages/ProjectOverviewPage";
import { ProjectNodesPage } from "@/pages/ProjectNodesPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = loadSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const session = loadSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.userRole !== "admin") {
    return <Navigate to="/projects" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <div className="h-full">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            }
          />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:taskId" element={<TaskPage />} />
            <Route path="tasks/inbox" element={<InboxPage />} />
            <Route path="tasks/library" element={<LibraryPage />} />
            <Route path="tasks/mobile" element={<MobilePage />} />
            <Route path="tasks/workflow" element={<WorkflowPage />} />
            <Route path="tasks/workflow-templates" element={<WorkflowTemplatesPage />} />
            <Route path="tasks/marketplace" element={<MarketplacePage />} />
            <Route path="scripts/*" element={<ProjectScriptsRoute />} />
            <Route path="nodes" element={<ProjectNodesPage />} />
          </Route>
          <Route path="/notes/*" element={<NotesFeature />} />
          <Route path="/tasks/projects" element={<Navigate to="/projects" replace />} />
          <Route path="/tasks/projects/:projectId/*" element={<LegacyProjectRedirect />} />
          <Route path="/script/*" element={<LegacyScriptRedirect />} />
        </Route>
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </div>
  );
}

function ProjectScriptsRoute(): React.JSX.Element {
  const { projectId } = useParams();
  if (projectId === undefined) {
    return <Navigate to="/projects" replace />;
  }
  return <ScriptFeature projectId={projectId} />;
}

function LegacyProjectRedirect(): React.JSX.Element {
  const { projectId } = useParams();
  if (projectId === undefined) {
    return <Navigate to="/projects" replace />;
  }
  return <Navigate to={`/projects/${projectId}`} replace />;
}

function LegacyScriptRedirect(): React.JSX.Element {
  const session = loadSession();
  if (session === null || session.projectId === null) {
    return <Navigate to="/projects" replace />;
  }
  return <Navigate to={`/projects/${session.projectId}/scripts`} replace />;
}

function RootRedirect(): React.JSX.Element {
  const session = loadSession();
  if (session === null) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/projects" replace />;
}
