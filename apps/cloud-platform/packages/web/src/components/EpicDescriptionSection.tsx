import { useEffect, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/button";

type EpicDescriptionSectionProps = {
  value: string;
  saving: boolean;
  onSave: (value: string) => void | Promise<void>;
};

export function EpicDescriptionSection({ value, saving, onSave }: EpicDescriptionSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const hasContent = value.trim().length > 0;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  async function save() {
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      return;
    }
  }

  return (
    <section className="panel-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Description</h2>
          <p className="text-[11px] text-muted-foreground">Markdown supported</p>
        </div>
        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {hasContent ? "Edit" : "Write"}
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={saving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4 p-5">
          <DescriptionEditor
            value={draft}
            onChange={setDraft}
            placeholder="What are we building? Include goals, scope, and done criteria."
            minRows={12}
            className="min-h-[14rem]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={saving}>
              Discard
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save description
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="cursor-text px-5 py-4 transition-colors hover:bg-white/[0.02]"
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEditing(true);
            }
          }}
          role="button"
          tabIndex={0}
        >
          {hasContent ? (
            <MarkdownView content={value} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No description yet. Click to add goals, scope, and acceptance notes.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
