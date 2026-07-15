import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SensitiveFieldProps = {
  label: string;
  value: string;
  onCopy: (() => void) | null;
};

export function SensitiveField(rawProps: Partial<SensitiveFieldProps> & Pick<SensitiveFieldProps, "label" | "value">) {
  let onCopy: (() => void) | null = null;
  if ("onCopy" in rawProps) {
    if (rawProps.onCopy === null) {
      onCopy = null;
    } else if (typeof rawProps.onCopy === "function") {
      onCopy = rawProps.onCopy;
    }
  }
  const { label, value } = rawProps;

  const [revealed, setRevealed] = useState(false);
  const hidden = value !== "—" && !revealed;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0d0d0d] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg">
          {revealed ? (
            <code className="break-all text-xs text-foreground">{value}</code>
          ) : (
            <code
              className={cn(
                "block break-all text-xs text-foreground",
                hidden && "select-none blur-lg brightness-75",
              )}
            >
              {hidden ? "████████████████" : value}
            </code>
          )}
          {hidden ? (
            <div className="pointer-events-none absolute inset-0 bg-background/60 backdrop-blur-sm" />
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {value !== "—" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRevealed((current) => !current)}>
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          ) : null}
          {onCopy !== null && revealed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SensitiveRevealProps = {
  children: React.ReactNode;
  label: string | null;
  hideLabel: string | null;
};

export function SensitiveReveal(rawProps: Partial<SensitiveRevealProps> & { children: React.ReactNode }) {
  let label = "Show";
  if ("label" in rawProps && typeof rawProps.label === "string") {
    label = rawProps.label;
  }
  let hideLabel = "Hide";
  if ("hideLabel" in rawProps && typeof rawProps.hideLabel === "string") {
    hideLabel = rawProps.hideLabel;
  }
  const { children } = rawProps;

  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <div className="relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d]">
        <div className="absolute inset-0 scale-110 bg-gradient-to-br from-muted via-muted-foreground/15 to-muted blur-2xl" />
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" />
        <Button variant="secondary" className="relative z-10" onClick={() => setRevealed(true)}>
          <Eye className="h-4 w-4" />
          {label}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setRevealed(false)}>
          <EyeOff className="h-4 w-4" />
          {hideLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}
