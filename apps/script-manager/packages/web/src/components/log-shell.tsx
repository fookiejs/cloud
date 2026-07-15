import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  taskName: string;
  onClear(): void;
  children: ReactNode;
}

export function LogShell(props: Props): React.JSX.Element {
  let subtitleEl: React.JSX.Element | null = null;
  if (props.taskName.length > 0) {
    subtitleEl = <div className="text-[10px] text-muted-foreground truncate">{props.taskName}</div>;
  }

  return (
    <div className="flex flex-col h-full border-l bg-card/40">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Logs</div>
          {subtitleEl}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={props.onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{props.children}</div>
    </div>
  );
}
