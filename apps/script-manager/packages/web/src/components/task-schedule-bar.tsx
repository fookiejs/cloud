import { resolveCronExpression } from '@/lib/cron-presets';
import { cronScheduleProgress, formatCronCountdown } from '@/lib/cron-schedule';
import { cn } from '@/lib/utils';

interface Props {
  triggerCron: string | null;
  nowMs: number;
  paused: boolean;
}

export function TaskScheduleBar(props: Props): React.JSX.Element {
  const expression = resolveCronExpression(props.triggerCron);
  const progress = cronScheduleProgress(expression, props.nowMs);
  const countdown = formatCronCountdown(expression, props.nowMs);

  return (
    <div className={cn('shrink-0 pt-1', props.paused && 'opacity-50')}>
      <div className="h-1 w-full rounded-full bg-muted/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/70 transition-[width] duration-300 ease-linear"
          style={{ width: `${String(Math.round(progress * 100))}%` }}
        />
      </div>
      <div className="text-[9px] text-muted-foreground mt-1 tabular-nums">Next in {countdown}</div>
    </div>
  );
}
