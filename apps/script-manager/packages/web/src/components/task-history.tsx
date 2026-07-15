import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import {
  formatDuration,
  formatRelative,
  formatTime,
  statusBadgeVariant,
  statusDotClass,
  statusLabel,
} from '@/lib/format';
import { collectRunDots, type RunDot } from '@/lib/runs';
import type { InspectTarget } from '@/components/run-dots';
import { actions, useStore, selectExecutionsOf, selectLiveLogsOf } from '@/state/store';
import type { Execution, ExecutionStatus } from '@/types';

interface Props {
  taskId: string;
  selectedId: string | null;
  onInspect(target: InspectTarget): void;
}

function cancelledRunWord(count: number): string {
  if (count === 1) {
    return 'run';
  }
  return 'runs';
}

function dotToInspect(taskId: string, d: RunDot): InspectTarget {
  let isLive = false;
  if (d.status === 'running') {
    isLive = true;
  }
  return { taskId, executionId: d.id, isLive };
}

function findExecution(history: readonly Execution[], id: string): Execution | null {
  for (const e of history) {
    if (e.id === id) {
      return e;
    }
  }
  return null;
}

export function TaskHistory(props: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const history = useStore((s) => selectExecutionsOf(s, props.taskId));
  const liveLogs = useStore((s) => selectLiveLogsOf(s, props.taskId));
  const liveExec = useStore((s) => s.liveExecutions);
  const [loading, setLoading] = useState(false);
  const [cancellingAll, setCancellingAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    void actions
      .refreshExecutionsForTask(props.taskId, 50)
      .catch((e: unknown) => {
        toast.error(String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [props.taskId]);

  const dots = collectRunDots(props.taskId, history, liveLogs, liveExec);

  let newestId = '';
  if (dots.length > 0) {
    const first = dots[0];
    if (first !== undefined) {
      newestId = first.id;
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) {
      return;
    }
    el.scrollTop = 0;
  }, [props.taskId, newestId, dots.length]);

  function reload(): void {
    setLoading(true);
    void actions.refreshExecutionsForTask(props.taskId, 50).finally(() => {
      setLoading(false);
    });
  }

  const runningIds: string[] = [];
  const runningSeen = new Set<string>();
  for (const d of dots) {
    if (d.status !== 'running') {
      continue;
    }
    if (runningSeen.has(d.id)) {
      continue;
    }
    runningSeen.add(d.id);
    runningIds.push(d.id);
  }
  for (const key of Object.keys(liveExec)) {
    const row = liveExec[key];
    if (row === undefined) {
      continue;
    }
    if (row.taskId !== props.taskId) {
      continue;
    }
    if (row.status !== 'running') {
      continue;
    }
    if (runningSeen.has(key)) {
      continue;
    }
    runningSeen.add(key);
    runningIds.push(key);
  }

  async function cancelAll(): Promise<void> {
    if (runningIds.length === 0) {
      return;
    }
    setCancellingAll(true);
    try {
      for (const id of runningIds) {
        await api.cancelExecution(id);
      }
      toast.success(
        `Cancelled ${String(runningIds.length)} ${cancelledRunWord(runningIds.length)}`,
      );
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setCancellingAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Run history ({String(dots.length)})
          </span>
          <div className="text-[10px] text-muted-foreground/70">Newest first</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {runningIds.length > 0 && (
            <Button
              type="button"
              variant="warn"
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => {
                void cancelAll();
              }}
              disabled={cancellingAll}
            >
              Cancel all
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading && dots.length === 0 && (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md animate-pulse shrink-0">
          Loading runs…
        </div>
      )}

      {!loading && dots.length === 0 && (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md shrink-0">
          No runs yet — use Run or wait for trigger
        </div>
      )}

      {dots.length > 0 && (
        <div ref={scrollRef} className="flex flex-col gap-1.5 overflow-y-auto min-h-0 flex-1 pr-1">
          {dots.map((d) => {
            const selected = props.selectedId === d.id;
            const exec = findExecution(history, d.id);
            let triggerText = 'live';
            let durationText = '—';
            let timeText = formatTime(d.startedAt);
            let exitText = '—';
            if (exec !== null) {
              triggerText = exec.trigger_reason;
              durationText = formatDuration(exec.started_at, exec.ended_at);
              timeText = formatTime(exec.started_at);
              if (exec.exit_code !== null) {
                exitText = String(exec.exit_code);
              }
            }
            let borderCls = 'border-border/60 hover:bg-muted/40';
            if (selected) {
              borderCls = 'border-border bg-secondary/30';
            }
            const st: ExecutionStatus | 'running' = d.status;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  props.onInspect(dotToInspect(props.taskId, d));
                }}
                className={cn(
                  'w-full shrink-0 flex flex-col gap-1 p-2.5 rounded-md border text-left transition-colors',
                  borderCls,
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', statusDotClass(st))} />
                  <Badge
                    variant={statusBadgeVariant(st)}
                    className="text-[10px] px-1.5 py-0 shrink-0"
                  >
                    {statusLabel(st)}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                    {triggerText}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelative(d.startedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground pl-4">
                  <span>{timeText}</span>
                  <span>{durationText}</span>
                  <span>exit {exitText}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
