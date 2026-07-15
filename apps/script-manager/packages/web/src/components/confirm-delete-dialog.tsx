import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeleteKind = 'task' | 'project';

interface Props {
  open: boolean;
  kind: DeleteKind;
  name: string;
  onOpenChange(open: boolean): void;
  onConfirm(): Promise<void>;
}

function titleForKind(kind: DeleteKind): string {
  if (kind === 'project') {
    return 'Delete project?';
  }
  return 'Delete task?';
}

function descriptionForKind(kind: DeleteKind, name: string): string {
  if (kind === 'project') {
    return `"${name}" and all of its tasks will be permanently removed. This cannot be undone.`;
  }
  return `"${name}" and its run history will be permanently removed. This cannot be undone.`;
}

export function ConfirmDeleteDialog(props: Props): React.JSX.Element {
  const [deleting, setDeleting] = useState(false);

  async function confirm(): Promise<void> {
    setDeleting(true);
    try {
      await props.onConfirm();
      props.onOpenChange(false);
    } catch (_e: unknown) {
      return;
    } finally {
      setDeleting(false);
    }
  }

  let confirmLabel = 'Delete';
  if (deleting) {
    confirmLabel = 'Deleting…';
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <DialogTitle>{titleForKind(props.kind)}</DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                {descriptionForKind(props.kind, props.name)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              void confirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
