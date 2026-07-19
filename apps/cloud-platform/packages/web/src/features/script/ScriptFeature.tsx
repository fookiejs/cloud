import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap, useStore } from "@script/state/store";
import { ProjectScriptView } from "@script/views/Workspace";
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

function ScriptHeader(props: { projectName: string }): React.JSX.Element {
  return (
    <div className="flex h-14 items-center gap-3 border-b px-6 py-5">
      <h1 className="text-sm font-semibold tracking-tight">Scripts</h1>
      <span className="text-xs text-muted-foreground">{props.projectName}</span>
    </div>
  );
}

function ScriptBodySkeleton(): React.JSX.Element {
  return (
    <div className="p-6">
      <ul className="flex max-w-3xl flex-col gap-1">
        <li>
          <Skeleton className="h-[4.25rem] w-full rounded-md" />
        </li>
        <li>
          <Skeleton className="h-[4.25rem] w-full rounded-md" />
        </li>
        <li>
          <Skeleton className="h-[4.25rem] w-full rounded-md" />
        </li>
      </ul>
    </div>
  );
}

function TaskRedirect(props: { basePath: string; projectName: string }): React.JSX.Element {
  const params = useParams();
  useEffect(() => {
    navigate(props.basePath);
  }, [params["taskId"], props.basePath]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScriptHeader projectName={props.projectName} />
      <ScriptBodySkeleton />
    </div>
  );
}

function ScriptProjectPage(props: {
  projectId: string;
  projectName: string;
}): React.JSX.Element {
  const { ready } = useBootstrap(props.projectId);
  const settings = useStore((state) => state.settings);
  if (!ready || settings === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ScriptHeader projectName={props.projectName} />
        <ScriptBodySkeleton />
      </div>
    );
  }
  return (
    <div className="w-full px-8 py-6">
      <ProjectScriptView projectId={props.projectId} projectName={props.projectName} />
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
