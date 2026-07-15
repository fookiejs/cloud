import { Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { runDotPreviewSizeClass } from '@/lib/run-dot-size';
import { statusDotClass, type DemoStatus } from '@/lib/status';

interface Props {
  name: string;
  trigger: string;
  status: DemoStatus;
  dots: readonly DemoStatus[];
  selected?: boolean;
  running?: boolean;
}

function actionButton(running: boolean | undefined): React.JSX.Element {
  if (running === true) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warn/15 text-warn border border-warn/30">
        <X className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Play className="w-3.5 h-3.5" />
    </span>
  );
}

export function DemoTaskTile(props: Props): React.JSX.Element {
  let statusCaption: string | null = null;
  if (props.running === true) {
    statusCaption = 'Running';
  } else if (props.status === 'success') {
    statusCaption = 'Success';
  }

  function captionClass(): string {
    if (props.running === true) {
      return 'text-primary';
    }
    return 'text-success';
  }

  let captionEl: React.JSX.Element | null = null;
  if (statusCaption !== null) {
    captionEl = (
      <span className={cn('text-xs font-medium shrink-0', captionClass())}>{statusCaption}</span>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card/80 p-3.5 flex flex-col gap-2.5 min-h-[5.5rem] relative overflow-hidden',
        props.selected === true && 'bg-secondary/20',
      )}
    >
      {props.selected === true && (
        <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-muted-foreground/45 pointer-events-none" />
      )}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full shrink-0',
            statusDotClass(props.status),
            props.running === true && 'animate-pulse',
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">{props.name}</div>
          <div className="flex items-center gap-2 min-w-0 mt-1">
            <span className="text-xs text-muted-foreground truncate">{props.trigger}</span>
            {captionEl}
          </div>
        </div>
        {actionButton(props.running)}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {props.dots.map((d, i) => (
          <span
            key={`${props.name}-${String(i)}`}
            className={cn(
              'rounded-sm shrink-0',
              runDotPreviewSizeClass(i),
              statusDotClass(d),
              d === 'running' && 'animate-pulse',
            )}
          />
        ))}
      </div>
    </div>
  );
}
