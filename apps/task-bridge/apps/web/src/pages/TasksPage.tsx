import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { CreateEpicModal } from "@/components/CreateEpicModal";
import { LoadMore } from "@/components/LoadMore";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useSession } from "@/hooks/useSession";
import { createEpic, fetchInbox, type InboxItem } from "@/lib/api";
import { formatWhen } from "@/lib/utils";

const PAGE_SIZE = 30;

function statusDot(status: string) {
  if (status === "ready") return "bg-emerald-500";
  if (status === "sent") return "bg-sky-500";
  return "bg-amber-500";
}

export function TasksPage() {
  const params = useParams();
  let projectId: string | null = null;
  if (typeof params["projectId"] === "string" && params["projectId"].length > 0) {
    projectId = params["projectId"];
  }
  const session = useSession();
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsCountRef = useRef(0);
  itemsCountRef.current = items.length;

  const load = useCallback(
    async (cursor: string | null, append: boolean, silent = false) => {
      if (!session || !projectId) return;
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const limit = silent ? Math.max(PAGE_SIZE, itemsCountRef.current) : PAGE_SIZE;
        const data = await fetchInbox(session, {
          projectId,
          epicsOnly: true,
          commentsOnly: null,
          cursor: silent ? null : cursor,
          limit,
        });
        setItems((prev) => (append ? prev.concat(data.items) : data.items));
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Failed to load tasks");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [session, projectId],
  );

  useAutoRefresh(
    useCallback(
      (silent: boolean) => {
        if (!silent) setItems([]);
        void load(null, false, silent);
      },
      [load],
    ),
    { enabled: Boolean(session && projectId) },
  );

  async function handleCreate(title: string, description: string) {
    if (!session || !projectId) return;
    setSending(true);
    try {
      await createEpic(session, {
        projectId,
        title,
        description,
      });
      setCreateOpen(false);
      toast.success("Epic created");
      void load(null, false, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create epic");
    } finally {
      setSending(false);
    }
  }

  let projectLabel = "Project";
  if (session !== null && session.projectName !== null) {
    projectLabel = session.projectName;
  } else if (projectId !== null) {
    projectLabel = projectId;
  }
  let projectTasksPath = "/projects";
  if (projectId !== null) {
    projectTasksPath = `/projects/${projectId}/tasks`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumb={[
          { label: "Projects", to: "/projects" },
          { label: projectLabel, to: projectTasksPath },
          { label: "Epics", to: null },
        ]}
        title="Epics"
        subtitle={items.length > 0 ? `${items.length}${hasMore ? "+" : ""} active` : "No epics yet"}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New epic
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5">
        {loading && items.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="panel-card flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">Create your first epic to start the pipeline.</p>
            <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New epic
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.taskId}
                to={`/projects/${projectId}/tasks/${item.taskId}`}
                className="panel-card group flex min-h-[7rem] flex-col justify-between p-4 transition-colors hover:border-white/[0.14] hover:bg-[#141414]"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusDot(item.status)}`} />
                    <span className="text-[11px] text-muted-foreground">#{item.taskId}</span>
                    {item.stageTitle ? (
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium">
                        {item.stageTitle}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-white group-hover:text-primary">
                    {item.title || `Task #${item.taskId}`}
                  </p>
                  {item.preview ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.preview}</p>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatWhen(
                      item.activityAt !== null
                        ? item.activityAt
                        : item.updatedAt !== null
                          ? item.updatedAt
                          : item.createdAt,
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <LoadMore
          loaded={items.length}
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={() => {
            void load(nextCursor, true);
          }}
        />
      </div>

      <CreateEpicModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        saving={sending}
        onCreate={(title, description) => void handleCreate(title, description)}
      />
    </div>
  );
}
