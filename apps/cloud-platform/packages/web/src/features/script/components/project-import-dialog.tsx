import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@script/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@script/api/client';
import type { ProjectExportBundle } from '@script/lib/project-export';

interface Props {
  open: boolean;
  bundle: ProjectExportBundle | null;
  projectId: string;
  onOpenChange(open: boolean): void;
  onImported(workspaceId: string): void;
}

function importButtonLabel(busy: boolean): string {
  if (busy) {
    return 'Importing…';
  }
  return 'Import';
}

export function ProjectImportDialog(props: Props): React.JSX.Element {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open || props.bundle === null) {
      return;
    }
    setName(props.bundle.project.name);
  }, [props.open, props.bundle]);

  async function submit(): Promise<void> {
    if (props.bundle === null) {
      return;
    }
    if (name.length === 0) {
      toast.error('Name is required');
      return;
    }
    setBusy(true);
    try {
      const r = await api.importProject({
        bundle: props.bundle,
        name,
        projectId: props.projectId,
      });
      toast.success(`Imported ${String(r.taskCount)} tasks`);
      props.onOpenChange(false);
      props.onImported(r.workspace.id);
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  let taskNote = '';
  if (props.bundle !== null) {
    taskNote = `${String(props.bundle.tasks.length)} tasks`;
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import workspace</DialogTitle>
          <DialogDescription>
            {`Creates a new workspace from JSON (${taskNote}) in an isolated sandbox on Fookie Cloud.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-project-name">Name</Label>
            <Input
              id="import-project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || props.bundle === null}
            onClick={() => {
              void submit();
            }}
          >
            {importButtonLabel(busy)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
