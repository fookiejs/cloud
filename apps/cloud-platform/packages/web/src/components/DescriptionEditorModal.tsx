import { useEffect, useState } from "react";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DescriptionEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: string;
  onSave: (value: string) => void;
  placeholder: string | null;
  saving: boolean | null;
};

export function DescriptionEditorModal(props: DescriptionEditorModalProps) {
  const { open, onOpenChange, title, value, onSave } = props;
  let placeholder: string | null = null;
  if (props.placeholder !== null) {
    placeholder = props.placeholder;
  }
  const saving = props.saving === true;
  const [draft, setDraft] = useState(value);
  const isSaving = saving;

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b border-white/[0.06] px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-4">
          <DescriptionEditor
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            minRows={18}
            className="min-h-[20rem]"
          />
        </div>
        <DialogFooter className="border-t border-white/[0.06] px-6 py-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => {
              onSave(draft);
            }}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
