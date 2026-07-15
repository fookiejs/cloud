import { useEffect, useRef } from "react";
import { Navigate, Outlet, useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { fetchProjects } from "@/lib/api";
import { setSelectedProject } from "@/lib/session";

export function ProjectLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !projectId) return;
    if (syncedRef.current === projectId) return;
    let active = true;
    void fetchProjects(session).then((projects) => {
      if (!active) return;
      const project = projects.find((item) => item.id === projectId);
      if (!project) {
        navigate("/projects", { replace: true });
        return;
      }
      setSelectedProject(project.id, project.name);
      syncedRef.current = projectId;
    });
    return () => {
      active = false;
    };
  }, [session, projectId, navigate]);

  if (!session) return <Navigate to="/login" replace />;
  if (!projectId) return <Navigate to="/projects" replace />;

  return <Outlet />;
}
