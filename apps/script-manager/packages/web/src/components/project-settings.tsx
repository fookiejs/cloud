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
import { Switch } from '@/components/ui/switch';
import { actions } from '@/state/store';
import { api } from '@/api/client';
import type { Workspace } from '@/types';

interface Props {
  workspace: Workspace;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ProjectSettingsDialog(props: Props): React.JSX.Element {
  const w = props.workspace;
  const [name, setName] = useState(w.name);
  const [path, setPath] = useState(w.path);
  const [saving, setSaving] = useState(false);
  const [live, setLive] = useState(!w.paused);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setName(w.name);
    setPath(w.path);
    setLive(!w.paused);
  }, [props.open, w.id, w.name, w.path, w.paused]);

  let saveLabel = 'Save';
  if (saving) {
    saveLabel = 'Saving…';
  }

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

  async function save(): Promise<void> {
    if (name.length === 0) {
      toast.error('Name is required');
      return;
    }
    if (path.length === 0) {
      toast.error('Path is required');
      return;
    }
    const liveChanged = live !== !w.paused;
    if (name === w.name && path === w.path && !liveChanged) {
      props.onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      if (liveChanged) {
        if (live) {
          await api.resumeWorkspace(w.id);
        } else {
          await api.pauseWorkspace(w.id);
        }
      }
      const body: { name?: string; path?: string } = {};
      if (name !== w.name) {
        body.name = name;
      }
      if (path !== w.path) {
        body.path = path;
      }
      if (name !== w.name || path !== w.path) {
        await api.updateWorkspace(w.id, body);
      }
      await actions.refreshWorkspaces();
      toast.success('Saved');
      props.onOpenChange(false);
    } catch (e: unknown) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Update name and folder path for this workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-ws-name-${w.id}`}>Name</Label>
            <Input
              id={`edit-ws-name-${w.id}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-ws-path-${w.id}`}>Folder path</Label>
            <div className="flex gap-2">
              <Input
                id={`edit-ws-path-${w.id}`}
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
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <Label>Resume</Label>
              <span className="text-[10px] text-muted-foreground">
                When on, triggers and file watching run for this project.
              </span>
            </div>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => {
              void save();
            }}
          >
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
