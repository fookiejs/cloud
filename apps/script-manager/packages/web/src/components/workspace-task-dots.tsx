import { cn } from '@/lib/utils';
import { statusDotClass, statusLabel } from '@/lib/format';
import { workspaceTaskStatusDots } from '@/lib/workspace-task-dots';
import { useStore, selectTasksOf } from '@/state/store';

interface Props {
  workspaceId: string;
  max?: number;
}

export function WorkspaceTaskDots(props: Props): React.JSX.Element | null {
  const tasksByWorkspace = useStore((s) => s.tasksByWorkspace);
  const executionsByTask = useStore((s) => s.executionsByTask);
  const liveExec = useStore((s) => s.liveExecutions);
  let limit = 8;
  if (props.max !== undefined) {
    limit = props.max;
  }
  const dots = workspaceTaskStatusDots(
    props.workspaceId,
    tasksByWorkspace,
    executionsByTask,
    liveExec,
    limit,
  );
  const tasks = useStore((s) => selectTasksOf(s, props.workspaceId));
  const extra = tasks.length - dots.length;

  if (dots.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0 max-w-[52px] flex-wrap justify-end">
      {dots.map((d) => {
        let pulse = '';
        if (d.status === 'running') {
          pulse = 'animate-pulse';
        }
        let label = 'Idle';
        if (d.status !== 'idle') {
          label = statusLabel(d.status);
        }
        return (
          <span
            key={d.taskId}
            className={cn('w-1.5 h-1.5 rounded-sm shrink-0', statusDotClass(d.status), pulse)}
            title={`${d.taskName}: ${label}`}
          />
        );
      })}
      {extra > 0 && (
        <span className="text-[8px] leading-none text-muted-foreground/80">+{String(extra)}</span>
      )}
    </div>
  );
}
