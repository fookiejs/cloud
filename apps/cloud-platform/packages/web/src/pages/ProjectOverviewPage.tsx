import { Bot, ListTodo, Server } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSession } from "@/hooks/useSession";

const projectApps = [
  {
    key: "tasks",
    title: "Tasks",
    description: "Plan epics, manage the inbox, and run project workflows.",
    icon: ListTodo,
  },
  {
    key: "scripts",
    title: "Scripts",
    description: "Create and run scripts on a node connected to this project.",
    icon: Bot,
  },
  {
    key: "nodes",
    title: "Nodes",
    description: "Connect a machine and choose the workspace used by this project.",
    icon: Server,
  },
] as const;

export function ProjectOverviewPage(): React.JSX.Element {
  const { projectId } = useParams();
  const session = useSession();
  const activeProjectId = projectId ?? "";
  const projectName = session?.projectName ?? activeProjectId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={projectName} subtitle="Project apps and infrastructure" />
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-6 md:grid-cols-3">
        {projectApps.map((projectApp) => {
          const Icon = projectApp.icon;
          return (
            <Link
              key={projectApp.key}
              to={`/projects/${activeProjectId}/${projectApp.key}`}
              className="panel-card group flex min-h-52 flex-col justify-between p-5 transition-colors hover:border-white/20 hover:bg-[#141414]"
            >
              <Icon className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-white" />
              <div>
                <h2 className="text-base font-semibold text-white">{projectApp.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {projectApp.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
