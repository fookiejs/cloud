import { cn } from '@/lib/utils';

interface Props {
  onMouseDown(e: React.MouseEvent): void;
  active: boolean;
}

export function ResizeHandle(props: Props): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="Resize panel"
      onMouseDown={props.onMouseDown}
      className={cn(
        'shrink-0 w-1.5 self-stretch cursor-col-resize border-x border-transparent',
        'hover:bg-primary/20 hover:border-primary/25',
        'active:bg-primary/35',
        props.active && 'bg-primary/25 border-primary/30',
      )}
    />
  );
}
