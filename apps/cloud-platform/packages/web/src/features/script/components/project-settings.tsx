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
import { Switch } from '@script/components/ui/switch';
import { actions } from '@script/state/store';
import { api } from '@script/api/client';
import type { Workspace } from '@script/types';

interface Props {
  workspace: Workspace;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ProjectSettingsDialog(props: Props): React.JSX.Element {
  const w = props.workspace;
  const [name, setName] = useState(w.name);
  const [saving, setSaving] = useState(false);
  const [live, setLive] = useState(!w.paused);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setName(w.name);
    setLive(!w.paused);
  }, [props.open, w.id, w.name, w.paused]);

  let saveLabel = 'Save';
  if (saving) {
    saveLabel = 'Saving…';
  }

  async function save(): Promise<void> {
    if (name.length === 0) {
      toast.error('Name is required');
      return;
    }
    const liveChanged = live !== !w.paused;
    if (name === w.name && !liveChanged) {
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
      if (name !== w.name) {
        await api.updateWorkspace(w.id, { name });
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
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>
            Update this workspace. Files live in an isolated sandbox on Fookie Cloud.
          </DialogDescription>
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
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <Label>Resume</Label>
              <span className="text-[10px] text-muted-foreground">
                When on, schedules and triggers run for this workspace.
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
