import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ResizeHandle } from '@/components/resize-handle';
import { useDragResize } from '@/hooks/use-drag-resize';
import { Download, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TaskTile } from '@/components/task-tile';
import { TaskDetailPanel } from '@/components/task-detail-panel';
import { api } from '@/api/client';
import { ProjectSettingsDialog } from '@/components/project-settings';
import { WorkspaceEnvironmentDialog } from '@/components/workspace-environment-dialog';
import { downloadProjectBundle, exportFileName } from '@/lib/project-export';
import { BLANK_TASK_BODY } from '@/lib/project-templates';
import type { InspectTarget } from '@/components/run-dots';
import { actions, useStore, selectTasksOf } from '@/state/store';
import type { Task } from '@/types';

const TASK_PAGE_SIZE = 24;

type DetailTab = 'task' | 'logs';

function detailPanelWidth(open: boolean, size: number): number {
  if (open) {
    return size;
  }
  return 0;
}

interface Props {
  workspaceId: string;
}

export function WorkspaceView(props: Props): React.JSX.Element {
  const workspace = useStore((s) => {
    for (const w of s.workspaces) {
      if (w.id === props.workspaceId) {
        return w;
      }
    }
    return null;
  });
  const liveExec = useStore((s) => s.liveExecutions);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inspect, setInspect] = useState<InspectTarget | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('task');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewportMaxDetail, setViewportMaxDetail] = useState(960);
  const detailResize = useDragResize({
    storageKey: 'lotaru-workspace-detail-width',
    initial: 560,
    min: 400,
    max: viewportMaxDetail,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const loadFirstPage = useCallback(async (): Promise<void> => {
    setLoadingTasks(true);
    try {
      const r = await api.listTasksPage(props.workspaceId, null, TASK_PAGE_SIZE);
      actions.mergeWorkspaceTasks(props.workspaceId, r.tasks);
      setNextCursor(r.nextCursor);
      const ids: string[] = [];
      for (const t of r.tasks) {
        ids.push(t.id);
      }
      await actions.refreshRunningExecutions();
      await actions.prefetchExecutionsForTasks(ids, 20);
      await actions.refreshRunningExecutions();
      setTasks(r.tasks);
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setLoadingTasks(false);
    }
  }, [props.workspaceId]);

  useEffect(() => {
    void loadFirstPage();
    setSelectedId(null);
    setInspect(null);
  }, [loadFirstPage]);

  useEffect(() => {
    function syncMax(): void {
      setViewportMaxDetail(Math.max(480, Math.floor(window.innerWidth * 0.78)));
    }
    syncMax();
    window.addEventListener('resize', syncMax);
    return () => {
      window.removeEventListener('resize', syncMax);
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    void actions.refreshExecutionsForTask(selectedId, 50);
  }, [selectedId]);

  const storeTasks = useStore((s) => selectTasksOf(s, props.workspaceId));

  useEffect(() => {
    setTasks((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const freshById = new Map<string, Task>();
      for (const row of storeTasks) {
        freshById.set(row.id, row);
      }
      const next: Task[] = [];
      for (const row of prev) {
        const fresh = freshById.get(row.id);
        if (fresh !== undefined) {
          next.push(fresh);
        } else {
          next.push(row);
        }
      }
      return next;
    });
  }, [storeTasks]);

  if (workspace === null) {
    return <div className="text-sm text-muted-foreground">Project not found.</div>;
  }

  const ws = workspace;

  let running = 0;
  for (const t of tasks) {
    for (const key of Object.keys(liveExec)) {
      const e = liveExec[key];
      if (e === undefined) {
        continue;
      }
      if (e.taskId === t.id && e.status === 'running') {
        running += 1;
      }
    }
  }

  let selectedTask: Task | null = null;
  if (selectedId !== null) {
    for (const t of tasks) {
      if (t.id === selectedId) {
        selectedTask = t;
      }
    }
    if (selectedTask === null) {
      for (const key of Object.keys(liveExec)) {
        const e = liveExec[key];
        if (e === undefined) {
          continue;
        }
        if (e.taskId === selectedId) {
          selectedTask = {
            id: selectedId,
            workspace_id: props.workspaceId,
            name: 'Task',
            command: '',
            runtime: 'shell',
            docker_image: null,
            docker_platform: null,
            trigger_type: 'manual',
            trigger_glob: null,
            trigger_cron: null,
            concurrency: 'restart',
            enabled: true,
            created_at: Date.now(),
          };
        }
      }
    }
  }

  let inspectId: string | null = null;
  if (inspect !== null) {
    inspectId = inspect.executionId;
  }

  function selectTask(taskId: string): void {
    if (selectedId === taskId) {
      setSelectedId(null);
      setInspect(null);
      setDetailTab('task');
      return;
    }
    setSelectedId(taskId);
    setInspect(null);
    setDetailTab('task');
  }

  function onInspect(target: InspectTarget): void {
    setSelectedId(target.taskId);
    setInspect(target);
    setDetailTab('logs');
  }

  async function loadMore(): Promise<void> {
    if (nextCursor === null) {
      return;
    }
    setLoadingTasks(true);
    try {
      const r = await api.listTasksPage(props.workspaceId, nextCursor, TASK_PAGE_SIZE);
      setTasks((prev) => {
        const merged = [...prev];
        for (const t of r.tasks) {
          let found = false;
          for (const existing of merged) {
            if (existing.id === t.id) {
              found = true;
            }
          }
          if (!found) {
            merged.push(t);
          }
        }
        return merged;
      });
      setNextCursor(r.nextCursor);
      actions.mergeWorkspaceTasks(props.workspaceId, r.tasks);
      const ids: string[] = [];
      for (const t of r.tasks) {
        ids.push(t.id);
      }
      await actions.refreshRunningExecutions();
      await actions.prefetchExecutionsForTasks(ids, 20);
      await actions.refreshRunningExecutions();
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setLoadingTasks(false);
    }
  }

  async function exportProject(): Promise<void> {
    setExporting(true);
    try {
      const bundle = await api.exportProject(ws.id);
      downloadProjectBundle(bundle, exportFileName(ws.name));
      toast.success('Project exported');
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  }

  async function setProjectLive(live: boolean): Promise<void> {
    try {
      if (live) {
        await api.resumeWorkspace(ws.id);
      } else {
        await api.pauseWorkspace(ws.id);
      }
      await actions.refreshWorkspaces();
      toast.success('Saved');
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  function adoptCreatedTask(task: Task): void {
    setTasks((prev) => [task, ...prev]);
    actions.upsertTask(task);
    setSelectedId(task.id);
    setInspect(null);
    setDetailTab('task');
  }

  async function createTask(): Promise<void> {
    setCreating(true);
    try {
      const r = await api.createTask(ws.id, BLANK_TASK_BODY);
      adoptCreatedTask(r.task);
      toast.success('Task created');
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  }

  let stateBadge: React.JSX.Element;
  if (ws.paused) {
    stateBadge = <Badge variant="warn">Paused</Badge>;
  } else if (running > 0) {
    stateBadge = <Badge variant="running">{`${String(running)} running`}</Badge>;
  } else {
    stateBadge = <Badge variant="success">Live</Badge>;
  }

  let detailOpen = false;
  if (selectedId !== null && selectedTask !== null) {
    detailOpen = true;
  }

  let detailBody: React.JSX.Element;
  if (selectedTask !== null) {
    detailBody = (
      <TaskDetailPanel
        task={selectedTask}
        inspectId={inspectId}
        inspect={inspect}
        detailTab={detailTab}
        onDetailTabChange={setDetailTab}
        existingTaskNames={tasks.map((row) => row.name)}
        onInspect={onInspect}
        onCancelExecution={(id) => {
          void api.cancelExecution(id);
        }}
        onClosePanel={() => {
          setSelectedId(null);
          setInspect(null);
          setDetailTab('task');
        }}
        onDuplicated={(task) => {
          adoptCreatedTask(task);
        }}
        onDeleted={(taskId) => {
          setSelectedId(null);
          setInspect(null);
          setDetailTab('task');
          setTasks((prev) => {
            const next: Task[] = [];
            for (const row of prev) {
              if (row.id !== taskId) {
                next.push(row);
              }
            }
            return next;
          });
        }}
      />
    );
  } else {
    detailBody = (
      <div className="flex items-center justify-center h-full p-6 text-sm text-muted-foreground text-center">
        Select a task tile to edit and browse run history.
      </div>
    );
  }

  return (
    <>
      <ProjectSettingsDialog workspace={ws} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <div className="flex h-[calc(100vh-4rem)] -mx-8 overflow-hidden">
        <div className="flex-1 min-w-[280px] flex flex-col px-6 border-r">
          <header className="flex items-center justify-between gap-3 py-3 border-b shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Project</span>
                {stateBadge}
              </div>
              <h1 className="text-lg font-semibold truncate">{ws.name}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <WorkspaceEnvironmentDialog
                workspaceId={ws.id}
                activeEnvironmentId={ws.active_environment_id}
              />
              <div className="flex items-center gap-2 px-2">
                <Switch
                  checked={!ws.paused}
                  onCheckedChange={(v) => {
                    void setProjectLive(v);
                  }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Resume</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => {
                  void exportProject();
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSettingsOpen(true);
                }}
              >
                <Settings2 className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void createTask();
                }}
                disabled={creating}
                size="sm"
              >
                New task
              </Button>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto py-3">
            {tasks.length === 0 && !loadingTasks && (
              <Card className="border-dashed">
                <div className="p-8 text-center text-sm text-muted-foreground">No tasks yet</div>
              </Card>
            )}
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
              {tasks.map((t) => (
                <TaskTile
                  key={t.id}
                  task={t}
                  selected={selectedId === t.id}
                  workspacePaused={ws.paused}
                  onSelect={() => {
                    selectTask(t.id);
                  }}
                />
              ))}
            </div>
            {nextCursor !== null && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void loadMore();
                  }}
                  disabled={loadingTasks}
                >
                  Load more
                </Button>
              </div>
            )}
          </div>
        </div>

        {detailOpen && (
          <ResizeHandle
            onMouseDown={detailResize.onHandleMouseDown}
            active={detailResize.dragging}
          />
        )}

        <div
          className={cn(
            'shrink-0 bg-card/20 flex flex-col overflow-hidden',
            detailOpen && !detailResize.dragging && 'transition-[width] duration-200 ease-out',
          )}
          style={{ width: detailPanelWidth(detailOpen, detailResize.size) }}
        >
          {detailBody}
        </div>
      </div>
    </>
  );
}
