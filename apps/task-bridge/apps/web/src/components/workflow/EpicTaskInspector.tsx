import { Link } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskSubtask, WorkStatus } from "@/lib/api";

type EpicTaskInspectorProps = {
  projectId: string;
  epicId: number;
  subtasks: TaskSubtask[];
  selected: TaskSubtask | null;
  updatingStatus: boolean;
  onClose: () => void;
  onStatusChange: (taskId: number, status: WorkStatus) => void;
};

function parentBlocksAdvance(selected: TaskSubtask, epicId: number, subtasks: TaskSubtask[]) {
  if (!selected.parentId || selected.parentId === epicId) return false;
  const parent = subtasks.find((entry) => entry.taskId === selected.parentId);
  return parent ? !parent.done : false;
}

const STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export function EpicTaskInspector({
  projectId,
  epicId,
  subtasks,
  selected,
  updatingStatus,
  onClose,
  onStatusChange,
}: EpicTaskInspectorProps) {
  const blockedByParent = selected ? parentBlocksAdvance(selected, epicId, subtasks) : false;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#0c0c0c]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {selected ? "Task" : "Details"}
        </p>
        {selected ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <div>
            <h2 className="text-sm font-semibold leading-snug text-white">{selected.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Step: {selected.stageTitle !== null ? selected.stageTitle : selected.stageId !== null ? selected.stageId : "—"}
              {selected.templateId ? null : " · Ad-hoc"}
            </p>
            {selected.claimedBy ? (
              <p className="mt-1 text-xs text-muted-foreground">Claimed by {selected.claimedBy}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Work status</p>
            {blockedByParent ? (
              <p className="text-xs text-amber-400/90">Parent task must be done first.</p>
            ) : null}
            <div className="grid grid-cols-1 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={selected.workStatus === option.value ? "default" : "outline"}
                  disabled={
                    updatingStatus ||
                    (blockedByParent && option.value !== "todo" && selected.workStatus !== option.value)
                  }
                  className={cn(
                    "justify-start",
                    selected.workStatus === option.value && option.value === "done" && "bg-emerald-600 hover:bg-emerald-600/90",
                    selected.workStatus === option.value && option.value === "in_progress" && "bg-yellow-600 hover:bg-yellow-600/90",
                    selected.workStatus === option.value && option.value === "todo" && "bg-zinc-600 hover:bg-zinc-600/90",
                  )}
                  onClick={() => onStatusChange(selected.taskId, option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" asChild className="w-full justify-start">
            <Link to={`/projects/${projectId}/tasks/${selected.taskId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open task page
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select a task on the canvas to view and update its status.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Use the <span className="font-medium text-foreground">+ Task</span> button under any step to add one.
          </p>
        </div>
      )}
    </aside>
  );
}
