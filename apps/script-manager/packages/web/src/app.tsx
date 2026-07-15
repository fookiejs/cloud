import { useEffect, useState } from 'react';
import { BrandSplash } from '@/components/brand-splash';
import { Sidebar } from '@/components/sidebar';
import { WaitingForAgent } from '@/components/waiting-for-agent';
import { useAgentConnection } from '@/hooks/use-agent-connection';
import { isCloudHost } from '@/lib/auth';
import { useBootstrap, useStore } from '@/state/store';
import { DashboardView } from '@/views/Dashboard';
import { McpView } from '@/views/Mcp';
import { WorkspaceView } from '@/views/Workspace';

type Route =
  | { kind: 'list' }
  | { kind: 'mcp' }
  | { kind: 'workspace'; id: string };

function parsePathWithTaskRedirect(pathname: string): {
  route: Route;
  taskRedirect: string | null;
} {
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === 'dashboard') {
    return { route: { kind: 'list' }, taskRedirect: null };
  }
  if (clean === 'mcp') {
    return { route: { kind: 'mcp' }, taskRedirect: null };
  }
  const parts = clean.split('/');
  if (parts.length === 2 && parts[0] === 'workspace' && typeof parts[1] === 'string') {
    return { route: { kind: 'workspace', id: parts[1] }, taskRedirect: null };
  }
  if (parts.length === 2 && parts[0] === 'task' && typeof parts[1] === 'string') {
    return { route: { kind: 'list' }, taskRedirect: parts[1] };
  }
  return { route: { kind: 'list' }, taskRedirect: null };
}

export function navigate(path: string): void {
  let p = path;
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  if (window.location.pathname === p) {
    return;
  }
  window.history.pushState({}, '', p);
  window.dispatchEvent(new Event('lotaru:navigate'));
}

function TaskRedirect(props: { taskId: string }): React.JSX.Element {
  const tasksByWorkspace = useStore((s) => s.tasksByWorkspace);
  useEffect(() => {
    for (const key of Object.keys(tasksByWorkspace)) {
      const list = tasksByWorkspace[key];
      if (list === undefined) {
        continue;
      }
      for (const t of list) {
        if (t.id === props.taskId) {
          navigate(`/workspace/${t.workspace_id}`);
          return;
        }
      }
    }
    navigate('/');
  }, [props.taskId, tasksByWorkspace]);
  return <BrandSplash title="Script Manager" subtitle="Opening task…" />;
}

function useRouteWithRedirect(): { route: Route; taskRedirect: string | null } {
  const [parsed, setParsed] = useState(() => parsePathWithTaskRedirect(window.location.pathname));
  useEffect(() => {
    const handler = (): void => {
      setParsed(parsePathWithTaskRedirect(window.location.pathname));
    };
    window.addEventListener('popstate', handler);
    window.addEventListener('lotaru:navigate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('lotaru:navigate', handler);
    };
  }, []);
  return parsed;
}

function Shell(props: {
  children: React.ReactNode;
  activeWorkspaceId?: string | undefined;
  activePage?: 'list' | 'mcp' | undefined;
}): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative flex-1">
        <Sidebar
          activeWorkspaceId={props.activeWorkspaceId}
          activePage={props.activePage}
        />
        <main className="pl-60 min-h-screen">{props.children}</main>
      </div>
    </div>
  );
}

function ConnectedApp(): React.JSX.Element {
  const { ready } = useBootstrap();
  const { route, taskRedirect } = useRouteWithRedirect();

  if (!ready) {
    return <BrandSplash title="Script Manager" subtitle="Loading…" />;
  }

  if (taskRedirect !== null) {
    return <TaskRedirect taskId={taskRedirect} />;
  }

  if (route.kind === 'workspace') {
    return (
      <Shell activeWorkspaceId={route.id}>
        <div className="w-full px-8 py-6">
          <WorkspaceView workspaceId={route.id} />
        </div>
      </Shell>
    );
  }

  if (route.kind === 'mcp') {
    return (
      <Shell activePage="mcp">
        <div className="max-w-[1600px] mx-auto px-8 py-8">
          <McpView />
        </div>
      </Shell>
    );
  }

  return (
    <Shell activePage="list">
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <DashboardView />
      </div>
    </Shell>
  );
}

export function App(): React.JSX.Element {
  const agent = useAgentConnection();

  if (isCloudHost()) {
    if (agent.checking) {
      return <BrandSplash title="Script Manager" subtitle="Checking agent…" />;
    }
    if (!agent.online) {
      return <WaitingForAgent info={agent.info} />;
    }
    return <ConnectedApp key="connected" />;
  }

  return <ConnectedApp />;
}
