import { NavLink, matchPath, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  FolderKanban,
  GitBranch,
  Inbox,
  ListTodo,
  NotebookPen,
  Palette,
  ShoppingBag,
  Smartphone,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FookieCloudMark } from "@/components/FookieCloudMark";
import { cn } from "@/lib/utils";
import { useCommentNotifications } from "@/hooks/useCommentNotifications";
import { useSession } from "@/hooks/useSession";
import { unreadCommentCount } from "@/lib/read-tasks";

export function AppSidebar() {
  const { pathname } = useLocation();
  const session = useSession();

  const projectMatch = matchPath("/projects/:projectId/*", pathname);
  let activeProjectId: string | null = null;
  if (projectMatch !== null) {
    const paramId = projectMatch.params.projectId;
    if (typeof paramId === "string" && paramId.length > 0) {
      activeProjectId = paramId;
    }
  }
  let fallbackProjectId: string | null = activeProjectId;
  if (fallbackProjectId === null && session !== null && session.projectId !== null) {
    fallbackProjectId = session.projectId;
  }
  const projectId = activeProjectId;
  let projectName: string | null = projectId;
  if (session !== null && session.projectName !== null) {
    projectName = session.projectName;
  } else if (projectId === null && fallbackProjectId !== null) {
    projectName = fallbackProjectId;
  }

  const { commentItems } = useCommentNotifications(session, projectId);
  const unread = unreadCommentCount(commentItems);

  const isAdmin = session !== null && session.userRole === "admin";

  return (
    <aside className="app-sidebar">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <FookieCloudMark href="/projects" />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          <NavItem to="/projects" label="Projects" icon={FolderKanban} end />
        </div>

        {projectId ? (
          <div className="space-y-0.5">
            <p className="truncate px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {projectName}
            </p>
            <NavItem to={`/projects/${projectId}/tasks`} label="Tasks" icon={ListTodo} />
            <NavItem to={`/projects/${projectId}/scripts`} label="Scripts" icon={Terminal} />
            <NavItem to={`/projects/${projectId}/notes`} label="Notes" icon={NotebookPen} />
            <NavItem to={`/projects/${projectId}/designs`} label="Designs" icon={Palette} />
          </div>
        ) : fallbackProjectId ? (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recent project
            </p>
            <NavItem
              to={`/projects/${fallbackProjectId}/tasks`}
              label={projectName !== null ? projectName : "Open project"}
              icon={ListTodo}
            />
          </div>
        ) : null}

        {projectId && pathname.startsWith(`/projects/${projectId}/tasks`) ? (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Task Bridge
            </p>
            <NavItem to={`/projects/${projectId}/tasks/inbox`} label="Inbox" icon={Inbox} badge={unread} />
            <NavItem to={`/projects/${projectId}/tasks/library`} label="Library" icon={BookOpen} />
            <NavItem to={`/projects/${projectId}/tasks/mobile`} label="Mobile" icon={Smartphone} />
            <NavItem to={`/projects/${projectId}/tasks/workflow`} label="Pipeline" icon={GitBranch} />
            <NavItem to={`/projects/${projectId}/tasks/marketplace`} label="Marketplace" icon={ShoppingBag} />
            <NavItem to={`/projects/${projectId}/tasks/workflow-templates`} label="Workflow templates" icon={GitBranch} />
          </div>
        ) : null}

        {isAdmin ? (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </p>
            <NavItem to="/admin/users" label="Team members" icon={Users} />
          </div>
        ) : null}

        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Platform
          </p>
          <ExternalNavItem href="https://grafana.fookiecloud.com" label="Grafana" icon={Activity} />
        </div>
      </nav>

      <div className="shrink-0">
        {session ? (
          <div className="border-t px-2 py-2">
            <a
              href="/profile"
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none text-foreground">
                  {session.userName}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{session.userEmail}</p>
              </div>
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ExternalNavItem(props: {
  href: string;
  label: string;
  icon: LucideIcon;
}): React.JSX.Element {
  const Icon = props.icon;
  const linkClass = "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground";
  const target = "_blank";
  const relationship = "noreferrer";
  return (
    <a href={props.href} target={target} rel={relationship} className={linkClass}>
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="flex-1 truncate">{props.label}</span>
    </a>
  );
}

type NavItemProps = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge: number | null;
  end: boolean | null;
};

function NavItem(rawProps: Partial<NavItemProps> & Pick<NavItemProps, "to" | "label" | "icon">) {
  let badge = 0;
  if ("badge" in rawProps && typeof rawProps.badge === "number") {
    badge = rawProps.badge;
  }
  let end = false;
  if ("end" in rawProps && rawProps.end === true) {
    end = true;
  }
  const { to, label, icon: Icon } = rawProps;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          "flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
          badge > 0 ? "bg-primary text-primary-foreground" : "invisible",
        )}
        aria-hidden={badge <= 0}
      >
        {badge > 0 ? badge : 0}
      </span>
    </NavLink>
  );
}
