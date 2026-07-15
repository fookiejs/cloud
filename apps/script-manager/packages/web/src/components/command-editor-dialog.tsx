import { useEffect, useState } from 'react';
import { Box, ChevronRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CommandShellEditor } from '@/components/command-shell-editor';
import { cn } from '@/lib/utils';
import type { RuntimeKind } from '@/types';

function runtimeLabel(runtime: RuntimeKind): string {
  if (runtime === 'docker') {
    return 'Docker';
  }
  return 'Shell';
}

function commandSummary(value: string): { configured: boolean; lines: number } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { configured: false, lines: 0 };
  }
  return { configured: true, lines: value.split(/\r?\n/).length };
}

function statusText(runtime: RuntimeKind, summary: { configured: boolean; lines: number }): string {
  if (!summary.configured) {
    return `Add ${runtimeLabel(runtime).toLowerCase()} script`;
  }
  if (summary.lines === 1) {
    return `1 line · ${runtimeLabel(runtime)}`;
  }
  return `${String(summary.lines)} lines · ${runtimeLabel(runtime)}`;
}

interface FieldProps {
  value: string;
  runtime: RuntimeKind;
  onSave: (command: string) => void;
  className?: string;
}

export function CommandField(props: FieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.value);

  useEffect(() => {
    if (!open) {
      setDraft(props.value);
    }
  }, [props.value, open]);

  function openEditor(): void {
    setDraft(props.value);
    setOpen(true);
  }

  function cancel(): void {
    setDraft(props.value);
    setOpen(false);
  }

  function save(): void {
    props.onSave(draft);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        props.onSave(draft);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, draft, props.onSave]);

  const summary = commandSummary(props.value);
  let RuntimeIcon = Terminal;
  if (props.runtime === 'docker') {
    RuntimeIcon = Box;
  }

  let iconBoxClass = 'border-border/60 bg-muted/40 text-muted-foreground';
  if (summary.configured) {
    iconBoxClass = 'border-primary/25 bg-primary/10 text-primary';
  }

  let commandSubtextClass = 'text-muted-foreground/80';
  if (summary.configured) {
    commandSubtextClass = 'text-muted-foreground';
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className={cn(
          'w-full text-left rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/35 shadow-sm transition-all px-4 py-3.5 shrink-0 group',
          props.className,
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border',
              iconBoxClass,
            )}
          >
            <RuntimeIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-none">Command</div>
            <div className={cn('text-xs mt-1.5 truncate', commandSubtextClass)}>
              {statusText(props.runtime, summary)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground group-hover:text-foreground/80">
            <span className="hidden sm:inline">Open</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            cancel();
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[min(96vw,56rem)] h-[min(88vh,720px)] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-xl">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-border/60">
            <DialogTitle>Edit command</DialogTitle>
            <DialogDescription>
              {runtimeLabel(props.runtime)} · syntax highlighted
            </DialogDescription>
          </DialogHeader>

          <div className="command-editor-body flex-1 min-h-0 px-5 py-4">
            <div className="command-editor-surface h-full min-h-[320px] rounded-lg border border-border/80 bg-[#0f1117] overflow-hidden">
              <CommandShellEditor value={draft} onChange={setDraft} />
            </div>
          </div>

          <DialogFooter className="px-5 py-4 shrink-0 border-t border-border/60 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
