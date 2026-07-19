import { cn } from '@/lib/utils';
import { statusDotClass } from '@script/lib/format';
import { runDotPreviewSizeClass } from '@script/lib/run-dot-size';
import { collectRunDots } from '@script/lib/runs';
import { useStore, selectExecutionsOf, selectLiveLogsOf } from '@script/state/store';

interface Props {
  scriptId: string;
  max?: number;
}

export function RunDotsPreview(props: Props): React.JSX.Element {
  const history = useStore((s) => selectExecutionsOf(s, props.scriptId));
  const liveLogs = useStore((s) => selectLiveLogsOf(s, props.scriptId));
  const liveExec = useStore((s) => s.liveExecutions);
  const allDots = collectRunDots(props.scriptId, history, liveLogs, liveExec);
  let limit = 12;
  if (props.max !== undefined) {
    limit = props.max;
  }
  const dots = allDots.slice(0, limit);
  const extra = allDots.length - dots.length;

  if (dots.length === 0) {
    return <span className="text-[9px] text-muted-foreground/60">—</span>;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap pointer-events-none">
      {dots.map((d, i) => {
        let pulse = '';
        if (d.status === 'running') {
          pulse = 'animate-pulse';
        }
        return (
          <span
            key={d.id}
            className={cn(
              'rounded-sm shrink-0',
              runDotPreviewSizeClass(i),
              statusDotClass(d.status),
              pulse,
            )}
          />
        );
      })}
      {extra > 0 && <span className="text-[9px] text-muted-foreground">+{String(extra)}</span>}
    </div>
  );
}
