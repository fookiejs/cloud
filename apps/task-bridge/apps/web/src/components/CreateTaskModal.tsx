import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CreateTaskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string | null;
  saving: boolean | null;
  onCreate: (title: string, description: string) => void;
};

export function CreateTaskModal({
  open,
  onOpenChange,
  targetLabel,
  saving = false,
  onCreate,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  const isSaving = saving === true;
  const canCreate = title.trim().length > 0 && !isSaving;

  let labelText = "this epic";
  if (targetLabel !== null) {
    labelText = targetLabel;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
          <DialogTitle>New task</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Adding to{" "}
            <span className="font-medium text-foreground">{labelText}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title"
              disabled={isSaving}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && canCreate) {
                  event.preventDefault();
                  onCreate(title.trim(), description.trim());
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to happen? (optional)"
              rows={5}
              disabled={isSaving}
              className="resize-y rounded-xl border-white/[0.1] bg-[#111111]"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-white/[0.06] px-6 py-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canCreate}
            onClick={() => onCreate(title.trim(), description.trim())}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
