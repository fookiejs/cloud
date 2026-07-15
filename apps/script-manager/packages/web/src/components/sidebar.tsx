import type { MouseEvent, ReactNode } from 'react';
import { Cable, Plus } from 'lucide-react';
import { FookieCloudMark } from '@/components/fookie-cloud-mark';
import { getUser, isCloudHost } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { WorkspaceTaskDots } from '@/components/workspace-task-dots';
import { useStore } from '@/state/store';
import { navigate } from '@/app';

const FOOKIE_PROFILE = 'https://fookiecloud.com/profile';

interface NavItemProps {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  trailing?: ReactNode;
}

function navItemClass(active: boolean): string {
  if (active) {
    return 'flex items-center gap-2 h-9 px-2.5 rounded-md text-sm font-medium transition-colors bg-secondary text-foreground';
  }
  return 'flex items-center gap-2 h-9 px-2.5 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60';
}

function NavItem(props: NavItemProps): React.JSX.Element {
  function onClick(e: MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault();
    navigate(props.href);
  }
  return (
    <a href={props.href} onClick={onClick} className={navItemClass(props.active)}>
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{props.icon}</span>
      <span className="flex-1 min-w-0 truncate">{props.label}</span>
      {props.trailing}
    </a>
  );
}

export function Sidebar(props: {
  activeWorkspaceId?: string | undefined;
  activePage?: 'list' | 'mcp' | undefined;
}): React.JSX.Element {
  const workspaces = useStore((s) => s.workspaces);
  const cloud = isCloudHost();
  const user = cloud ? getUser() : null;
  let displayName = 'Profile';
  let displayEmail = '';
  if (user !== null) {
    if (user.name !== null && user.name.length > 0) {
      displayName = user.name;
    } else if (user.email !== null && user.email.length > 0) {
      displayName = user.email;
    }
    if (user.email !== null) {
      displayEmail = user.email;
    }
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-card/40 border-r flex flex-col">
      <button
        type="button"
        onClick={() => {
          navigate('/');
        }}
        className="flex items-center px-4 h-14 border-b hover:bg-secondary/40 transition-colors w-full text-left"
      >
        <span className="text-sm font-semibold tracking-tight">Script Manager</span>
      </button>

      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="px-2 flex items-center justify-between h-6">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Projects
            </span>
            <button
              type="button"
              onClick={() => {
                navigate('/');
              }}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm w-5 h-5 grid place-items-center"
              title="Add project"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {workspaces.length === 0 && (
            <div className="text-xs text-muted-foreground px-2.5 py-1.5">No projects yet</div>
          )}
          <div className="flex flex-col gap-0.5">
            {workspaces.map((w) => {
              let dotCls = 'bg-success';
              if (w.paused) {
                dotCls = 'bg-warn';
              }
              return (
                <NavItem
                  key={w.id}
                  href={`/workspace/${w.id}`}
                  active={props.activeWorkspaceId === w.id}
                  icon={<span className={cn('w-1.5 h-1.5 rounded-full', dotCls)} />}
                  label={w.name}
                  trailing={<WorkspaceTaskDots workspaceId={w.id} max={8} />}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <NavItem
            href="/mcp"
            active={props.activePage === 'mcp'}
            icon={<Cable className="w-4 h-4" />}
            label="MCP"
          />
        </div>
      </nav>

      {cloud ? (
        <div className="shrink-0">
          <div className="border-t px-2 py-2">
            <div className="px-2.5 py-2">
              <FookieCloudMark size="sm" />
            </div>
          </div>
          <div className="border-t px-2 py-2">
            <a
              href={FOOKIE_PROFILE}
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none text-foreground">
                  {displayName}
                </p>
                {displayEmail.length > 0 ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{displayEmail}</p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Fookie Cloud</p>
                )}
              </div>
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
