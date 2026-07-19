import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useBootstrap } from "@script/state/store";
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

function ScriptRedirect(props: { basePath: string; projectName: string }): React.JSX.Element {
  const params = useParams();
  useEffect(() => {
    navigate(props.basePath);
  }, [params["scriptId"], props.basePath]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScriptHeader projectName={props.projectName} />
    </div>
  );
}

function ScriptProjectPage(props: {
  projectId: string;
  projectName: string;
}): React.JSX.Element {
  useBootstrap(props.projectId);
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
          path="script/:scriptId"
          element={<ScriptRedirect basePath={basePath} projectName={props.projectName} />}
        />
        <Route path="workspace/:workspaceId" element={<Navigate to={basePath} replace />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </>
  );
}
