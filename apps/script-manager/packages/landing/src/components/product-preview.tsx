import { DemoTaskDetail } from '@/components/demo-task-detail';
import { DemoTaskTile } from '@/components/demo-task-tile';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export function ProductPreview(props: Props): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/40 shadow-2xl shadow-black/40 overflow-hidden backdrop-blur-sm',
        props.className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 bg-card/60">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">my-app</div>
          <div className="text-[10px] text-muted-foreground truncate">~/projects/my-app</div>
        </div>
        <span className="text-[10px] text-primary font-medium shrink-0">1 running</span>
      </div>

      <div className="flex min-h-[300px] sm:min-h-[320px]">
        <div className="flex-1 min-w-0 p-3 border-r border-border/60">
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,140px),1fr))]">
            <DemoTaskTile
              name="build-api"
              trigger="on save"
              status="success"
              selected
              dots={['success', 'success', 'failed', 'success', 'success', 'success', 'success']}
            />
            <DemoTaskTile
              name="lint"
              trigger="manual"
              status="idle"
              dots={['success', 'success', 'cancelled', 'success']}
            />
            <DemoTaskTile
              name="scan"
              trigger="on save"
              status="running"
              running
              dots={['success', 'running', 'success', 'success']}
            />
            <DemoTaskTile
              name="test"
              trigger="startup"
              status="success"
              dots={['success', 'success']}
            />
          </div>
        </div>

        <div className="w-1 shrink-0 bg-border/40 hidden sm:block" aria-hidden />

        <div className="hidden sm:flex w-[min(42%,220px)] shrink-0 min-h-0 bg-card/25">
          <DemoTaskDetail />
        </div>
      </div>
    </div>
  );
}
