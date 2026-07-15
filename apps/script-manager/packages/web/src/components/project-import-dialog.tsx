import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/api/client';
import type { ProjectExportBundle } from '@/lib/project-export';

interface Props {
  open: boolean;
  bundle: ProjectExportBundle | null;
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
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open || props.bundle === null) {
      return;
    }
    setName(props.bundle.project.name);
    setPath(props.bundle.project.path);
  }, [props.open, props.bundle]);

  async function pickDir(): Promise<void> {
    try {
      const { path: picked } = await api.pickFolder();
      if (picked === null || picked.length === 0) {
        return;
      }
      setPath(picked);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function submit(): Promise<void> {
    if (props.bundle === null) {
      return;
    }
    if (name.length === 0 || path.length === 0) {
      toast.error('Name and path are required');
      return;
    }
    setBusy(true);
    try {
      const r = await api.importProject({
        bundle: props.bundle,
        name,
        path,
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
          <DialogTitle>Import project</DialogTitle>
          <DialogDescription>
            {`Creates a new project from JSON (${taskNote}). Pick the folder on this machine.`}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-project-path">Folder path</Label>
            <div className="flex gap-2">
              <Input
                id="import-project-path"
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                }}
                className="h-9 font-mono text-xs flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => {
                  void pickDir();
                }}
              >
                <Folder className="w-4 h-4" />
              </Button>
            </div>
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
