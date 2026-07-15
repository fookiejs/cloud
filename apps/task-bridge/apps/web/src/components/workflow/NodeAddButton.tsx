import type { CSSProperties, MouseEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NodeAddButtonProps = {
  title: string;
  onClick: () => void;
  className: string | null;
  disabled: boolean | null;
  style: CSSProperties | null;
  dataEpicAdd: string | null;
  dataNodeInsert: string | null;
  dataStageInsert: string | null;
};

export function NodeAddButton(rawProps: Partial<NodeAddButtonProps> & Pick<NodeAddButtonProps, "title" | "onClick">) {
  const { title, onClick } = rawProps;
  let className: string | null = null;
  if ("className" in rawProps) {
    if (typeof rawProps.className === "string") {
      className = rawProps.className;
    } else if (rawProps.className === null) {
      className = null;
    }
  }
  let disabledProp = false;
  if ("disabled" in rawProps && rawProps.disabled === true) {
    disabledProp = true;
  }
  let style: CSSProperties = {};
  if ("style" in rawProps) {
    const rawStyle = rawProps.style;
    if (typeof rawStyle !== "undefined" && rawStyle !== null) {
      style = rawStyle;
    }
  }
  let dataEpicAdd: string | null = null;
  if ("dataEpicAdd" in rawProps && typeof rawProps.dataEpicAdd === "string") {
    dataEpicAdd = rawProps.dataEpicAdd;
  }
  let dataNodeInsert: string | null = null;
  if ("dataNodeInsert" in rawProps && typeof rawProps.dataNodeInsert === "string") {
    dataNodeInsert = rawProps.dataNodeInsert;
  }
  let dataStageInsert: string | null = null;
  if ("dataStageInsert" in rawProps && typeof rawProps.dataStageInsert === "string") {
    dataStageInsert = rawProps.dataStageInsert;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={title}
      disabled={disabledProp}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto relative z-10 h-7 w-7 shrink-0 rounded-md border-white/[0.12] bg-[#111111] p-0 text-muted-foreground shadow-sm hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        className,
      )}
      style={style}
      data-epic-add={dataEpicAdd}
      data-node-insert={dataNodeInsert}
      data-stage-insert={dataStageInsert}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  );
}
