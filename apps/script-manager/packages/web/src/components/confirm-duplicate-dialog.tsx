import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  name: string;
  copyName: string;
  onOpenChange(open: boolean): void;
  onConfirm(): Promise<void>;
}

export function ConfirmDuplicateDialog(props: Props): React.JSX.Element {
  const [duplicating, setDuplicating] = useState(false);

  async function confirm(): Promise<void> {
    setDuplicating(true);
    try {
      await props.onConfirm();
      props.onOpenChange(false);
    } catch (_e: unknown) {
      return;
    } finally {
      setDuplicating(false);
    }
  }

  let confirmLabel = 'Duplicate';
  if (duplicating) {
    confirmLabel = 'Duplicating…';
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
              <Copy className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5 pt-0.5">
              <DialogTitle>Duplicate task?</DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                {`A copy of "${props.name}" will be created as "${props.copyName}".`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="px-6 py-4 border-t bg-muted/30 sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={duplicating}
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={duplicating}
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
