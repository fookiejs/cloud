import type { MouseEvent } from 'react';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusDotClass } from '@/lib/format';
import { runDotPreviewSizeClass } from '@/lib/run-dot-size';
import { collectRunDots, type RunDot } from '@/lib/runs';
import { useStore, selectExecutionsOf, selectLiveLogsOf } from '@/state/store';
import type { ExecutionStatus } from '@/types';

export interface InspectTarget {
  taskId: string;
  executionId: string;
  isLive: boolean;
}

interface Props {
  taskId: string;
  onInspect(target: InspectTarget): void;
  compact?: boolean;
}

function dotTitle(status: ExecutionStatus | 'running'): string {
  if (status === 'running') {
    return 'Running';
  }
  if (status === 'success') {
    return 'Success';
  }
  if (status === 'failed') {
    return 'Failed';
  }
  if (status === 'cancelled') {
    return 'Cancelled';
  }
  return 'Pending';
}

export function RunDots(props: Props): React.JSX.Element {
  const history = useStore((s) => selectExecutionsOf(s, props.taskId));
  const liveLogs = useStore((s) => selectLiveLogsOf(s, props.taskId));
  const liveExec = useStore((s) => s.liveExecutions);
  const allDots = collectRunDots(props.taskId, history, liveLogs, liveExec);
  let dots = allDots;
  if (props.compact === true) {
    dots = allDots.slice(0, 10);
  }

  function openLast(e: MouseEvent): void {
    e.stopPropagation();
    if (dots.length === 0) {
      return;
    }
    const first = dots[0];
    if (first === undefined) {
      return;
    }
    let isLive = false;
    if (first.status === 'running') {
      isLive = true;
    }
    props.onInspect({ taskId: props.taskId, executionId: first.id, isLive });
  }

  function onDotClick(e: MouseEvent, d: RunDot): void {
    e.stopPropagation();
    let isLive = false;
    if (d.status === 'running') {
      isLive = true;
    }
    props.onInspect({
      taskId: props.taskId,
      executionId: d.id,
      isLive,
    });
  }

  const isCompact = props.compact === true;

  let gapCls = 'gap-2';
  if (isCompact) {
    gapCls = 'gap-1';
  }

  let dotsWrapCls = 'items-center gap-0.5';
  if (isCompact) {
    dotsWrapCls = 'items-center gap-1';
  }

  return (
    <div className={cn('flex items-center min-w-0', gapCls)}>
      {!isCompact && (
        <button
          type="button"
          onClick={openLast}
          disabled={dots.length === 0}
          className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 p-1 rounded hover:bg-secondary/60"
          title="Last run log"
        >
          <ScrollText className="w-3.5 h-3.5" />
        </button>
      )}
      <div className={cn('flex flex-wrap min-w-0', dotsWrapCls)}>
        {dots.length === 0 && !isCompact && (
          <span className="text-[10px] text-muted-foreground">no runs</span>
        )}
        {dots.map((d, i) => {
          let pulse = '';
          if (d.status === 'running') {
            pulse = 'animate-pulse ring-1 ring-running/50';
          }
          let sizeCls = 'w-2 h-2';
          if (isCompact) {
            sizeCls = runDotPreviewSizeClass(i);
          }
          return (
            <button
              key={d.id}
              type="button"
              title={dotTitle(d.status)}
              onClick={(e) => {
                onDotClick(e, d);
              }}
              className={cn(
                'rounded-sm shrink-0 hover:scale-125 transition-transform',
                sizeCls,
                statusDotClass(d.status),
                pulse,
              )}
            />
          );
        })}
        {isCompact && allDots.length > 10 && (
          <span className="text-[9px] text-muted-foreground">+{String(allDots.length - 10)}</span>
        )}
      </div>
    </div>
  );
}
