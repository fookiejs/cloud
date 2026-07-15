import { type MouseEvent, useState } from 'react';
import { useStatusFlash } from '@/hooks/use-status-flash';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { cronPresetLabel, resolveCronExpression } from '@/lib/cron-presets';
import { statusCaptionClass, statusDotClass, statusLabel } from '@/lib/format';
import { RunDotsPreview } from '@/components/run-dots-preview';
import { TaskScheduleBar } from '@/components/task-schedule-bar';
import { useStableRunning } from '@/hooks/use-stable-running';
import { useTick } from '@/hooks/use-tick';
import { api } from '@/api/client';
import { actions } from '@/state/store';
import { findRunningExecutionId, taskHasLiveRunning } from '@/lib/task-running';
import { useStore, selectExecutionsOf, selectLiveLogsOf } from '@/state/store';
import type { Execution, Task, ExecutionStatus } from '@/types';

function lastStatus(
  taskId: string,
  liveExec: Record<string, { taskId: string; status: ExecutionStatus }>,
  history: readonly Execution[],
): ExecutionStatus | 'idle' {
  if (taskHasLiveRunning(taskId, liveExec, history)) {
    return 'running';
  }
  const last = history[0];
  if (last === undefined) {
    return 'idle';
  }
  return last.status;
}

function triggerSummary(t: Task): string {
  if (t.trigger_type === 'save') {
    return 'on save';
  }
  if (t.trigger_type === 'startup') {
    return 'startup';
  }
  if (t.trigger_type === 'scheduled') {
    return cronPresetLabel(resolveCronExpression(t.trigger_cron));
  }
  return 'manual';
}

function stopBubble(e: MouseEvent): void {
  e.stopPropagation();
}

interface Props {
  task: Task;
  selected: boolean;
  workspacePaused: boolean;
  onSelect(): void;
}

export function TaskTile(props: Props): React.JSX.Element {
  const t = props.task;
  const history = useStore((s) => selectExecutionsOf(s, t.id));
  const liveExec = useStore((s) => s.liveExecutions);
  const live = useStore((s) => selectLiveLogsOf(s, t.id));
  const isRunning = taskHasLiveRunning(t.id, liveExec, history);
  const stableRunning = useStableRunning(isRunning, 500);
  const [runPending, setRunPending] = useState(false);
  const status = lastStatus(t.id, liveExec, history);
  const isScheduled = t.trigger_type === 'scheduled' && t.enabled;
  const nowMs = useTick(250, isScheduled);

  async function run(e: MouseEvent): Promise<void> {
    stopBubble(e);
    if (isRunning || runPending) {
      return;
    }
    setRunPending(true);
    try {
      await api.runTask(t.id);
    } finally {
      setRunPending(false);
    }
  }

  async function cancel(e: MouseEvent): Promise<void> {
    stopBubble(e);
    const executionId = findRunningExecutionId(t.id, liveExec, history, live);
    if (executionId === null) {
      return;
    }
    await api.cancelExecution(executionId);
    void actions.refreshExecutionsForTask(t.id);
    void actions.refreshRunningExecutions();
  }

  const showCancel = isRunning || runPending;

  let runBtn: React.JSX.Element;
  if (showCancel) {
    runBtn = (
      <Button
        type="button"
        onClick={(e) => {
          void cancel(e);
        }}
        variant="warn"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    );
  } else {
    runBtn = (
      <Button
        type="button"
        onClick={(e) => {
          void run(e);
        }}
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        disabled={!t.enabled || props.workspacePaused}
      >
        <Play className="w-3.5 h-3.5" />
      </Button>
    );
  }

  let statusCaption: string | null = null;
  if (stableRunning) {
    statusCaption = 'Running';
  } else if (status !== 'idle') {
    statusCaption = statusLabel(status);
  }

  let statusKey: typeof status | 'running' = status;
  if (stableRunning) {
    statusKey = 'running';
  }
  const flash = useStatusFlash(statusKey);

  let dataFlash: string | undefined;
  if (flash !== null) {
    dataFlash = flash;
  }

  let dotClass = statusDotClass(status);
  if (stableRunning) {
    dotClass = 'bg-running/45 animate-pulse';
  }

  let statusLine: React.JSX.Element | null = null;
  if (statusCaption !== null) {
    statusLine = (
      <span
        className={cn('text-xs font-medium shrink-0', statusCaptionClass(status, stableRunning))}
      >
        {statusCaption}
      </span>
    );
  }

  return (
    <Card
      className={cn(
        'cursor-pointer hover:bg-secondary/20 transition-colors overflow-hidden flex flex-col relative min-h-[5.5rem]',
        flash !== null && 'task-card-flash',
        props.selected && 'bg-secondary/20',
        !t.enabled && 'opacity-55',
        props.workspacePaused && 'opacity-70',
      )}
      data-flash={dataFlash}
      onClick={props.onSelect}
    >
      {props.selected && (
        <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-muted-foreground/45 pointer-events-none" />
      )}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotClass)} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold leading-tight truncate">{t.name}</div>
            <div className="flex items-center gap-2 min-w-0 mt-1">
              <span className="text-xs text-muted-foreground truncate">{triggerSummary(t)}</span>
              {statusLine}
            </div>
          </div>
          <div onClick={stopBubble} className="shrink-0">
            {runBtn}
          </div>
        </div>
        <RunDotsPreview taskId={t.id} max={14} />
        {isScheduled && (
          <TaskScheduleBar
            triggerCron={t.trigger_cron}
            nowMs={nowMs}
            paused={props.workspacePaused || !t.enabled}
          />
        )}
      </div>
    </Card>
  );
}
