import { useRef, useState } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/utils";

type DescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string | null;
  minRows: number | null;
  className: string | null;
};

export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Write in markdown…",
  minRows = 10,
  className = null,
}: DescriptionEditorProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();
  const rows = minRows !== null ? minRows : 10;
  let placeholderText = "Write in markdown…";
  if (placeholder !== null) {
    placeholderText = placeholder;
  }

  function applyEdit(
    edit: (start: number, end: number, text: string) => { text: string; start: number; end: number },
  ) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = edit(start, end, value);
    onChange(next.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  }

  function wrapSelection(before: string, after: string) {
    applyEdit((start, end, text) => {
      const selected = text.slice(start, end);
      const wrapped = `${before}${selected || "text"}${after}`;
      const updated = text.slice(0, start) + wrapped + text.slice(end);
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + (selected || "text").length;
      return { text: updated, start: cursorStart, end: cursorEnd };
    });
  }

  function insertLine(prefix: string) {
    applyEdit((start, end, text) => {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = text.indexOf("\n", end);
      const sliceEnd = lineEnd === -1 ? text.length : lineEnd;
      const line = text.slice(lineStart, sliceEnd).replace(/^\s+/, "");
      const updated =
        text.slice(0, lineStart) + prefix + line + text.slice(sliceEnd);
      const cursor = lineStart + prefix.length + line.length;
      return { text: updated, start: cursor, end: cursor };
    });
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0c]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <TabButton active={mode === "write"} onClick={() => setMode("write")}>
            Write
          </TabButton>
          <TabButton active={mode === "preview"} onClick={() => setMode("preview")}>
            Preview
          </TabButton>
        </div>
        {mode === "write" ? (
          <div className="flex items-center gap-0.5">
            <ToolbarButton label="Bold" onClick={() => wrapSelection("**", "**")}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => wrapSelection("*", "*")}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Heading" onClick={() => insertLine("## ")}>
              <Heading2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Bullet list" onClick={() => insertLine("- ")}>
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Numbered list" onClick={() => insertLine("1. ")}>
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Link" onClick={() => wrapSelection("[", "](url)")}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">Markdown</span>
        )}
      </div>
      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholderText}
          rows={rows}
          className="w-full resize-y border-0 bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      ) : (
        <div className="min-h-[10rem] px-4 py-3">
          {trimmed ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm italic text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-white/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
    >
      {children}
    </button>
  );
}
