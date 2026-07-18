import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { BrandSplash } from "@/components/BrandSplash";
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

const MIN_SPLASH_MS = 2000;

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
    return <Navigate to="/tasks/projects" replace />;
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
          <Route path="/tasks/projects" element={<ProjectsPage />} />
          <Route path="/tasks/profile" element={<ProfilePage />} />
          <Route path="/tasks/workflow-templates" element={<WorkflowTemplatesPage />} />
          <Route path="/tasks/marketplace" element={<MarketplacePage />} />
          <Route
            path="/tasks/admin/users"
            element={
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            }
          />
          <Route path="/tasks/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="tasks" replace />} />
            <Route path="board" element={<Navigate to="tasks" replace />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/:taskId" element={<TaskPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="mobile" element={<MobilePage />} />
            <Route path="workflow" element={<WorkflowPage />} />
          </Route>
          <Route path="/script/*" element={<ScriptFeature />} />
          <Route path="/notes/*" element={<NotesFeature />} />
        </Route>
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </div>
  );
}

function RootRedirect() {
  const session = loadSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) {
    return <BrandSplash title="FookieCloud" subtitle="Loading…" />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.projectId) {
    return <Navigate to={`/tasks/projects/${session.projectId}/tasks`} replace />;
  }
  return <Navigate to="/tasks/projects" replace />;
}
