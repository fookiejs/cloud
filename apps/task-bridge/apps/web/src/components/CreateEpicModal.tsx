import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateEpicModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onCreate: (title: string, description: string) => void;
};

export function CreateEpicModal({ open, onOpenChange, saving, onCreate }: CreateEpicModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  const canCreate = title.trim().length > 0 && !saving;

  function submit() {
    if (!canCreate) return;
    onCreate(title.trim(), description.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>New epic</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Starts the pipeline — add context so the team and agents know the goal.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92vh-10rem)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="epic-title">Title</Label>
            <Input
              id="epic-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. User onboarding redesign"
              disabled={saving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canCreate) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <DescriptionEditor
              value={description}
              onChange={setDescription}
              placeholder="Goals, scope, acceptance criteria, links…"
              minRows={14}
              className="min-h-[16rem]"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-white/[0.06] px-6 py-4">
          <p className="mr-auto hidden text-[11px] text-muted-foreground sm:block">
            Ctrl+Enter to create
          </p>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canCreate} onClick={submit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create epic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
