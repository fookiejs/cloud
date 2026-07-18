import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkflowInspectorSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pulseKey: number | null;
  children: React.ReactNode;
};

export function WorkflowInspectorSidebar(rawProps: Partial<WorkflowInspectorSidebarProps> & Pick<WorkflowInspectorSidebarProps, "open" | "onOpenChange" | "children">) {
  let pulseKey = 0;
  if ("pulseKey" in rawProps && typeof rawProps.pulseKey === "number") {
    pulseKey = rawProps.pulseKey;
  }
  const { open, onOpenChange, children } = rawProps;

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-l border-white/[0.07] bg-[#0a0a0a] transition-[width] duration-200 ease-out",
        open ? "w-[380px]" : "w-11",
      )}
    >
      <div className="absolute -left-3 top-4 z-10">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-full border-white/[0.12] bg-[#141414] shadow-lg"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? "Collapse panel" : "Expand panel"}
        >
          {open ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {open ? (
        <div
          key={pulseKey}
          className={cn("inspector-reveal flex-1 overflow-y-auto p-4 pl-5", pulseKey > 0 && "inspector-reveal-active")}
        >
          {children}
        </div>
      ) : null}
    </aside>
  );
}
