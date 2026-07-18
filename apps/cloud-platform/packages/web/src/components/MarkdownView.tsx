import { useMemo } from "react";
import { marked } from "marked";
import { cn } from "@/lib/utils";

marked.setOptions({
  gfm: true,
  breaks: true,
});

type MarkdownViewProps = {
  content: string | null;
  className: string | null;
  variant: "default" | "comment" | null;
};

export function MarkdownView(rawProps: Partial<MarkdownViewProps> & { content: string | null }) {
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  let variant: "default" | "comment" = "default";
  if ("variant" in rawProps && rawProps.variant === "comment") {
    variant = "comment";
  }
  const { content } = rawProps;

  const html = useMemo(() => {
    const trimmed = content !== null ? content.trim() : "";
    if (!trimmed) return "";
    return marked.parse(trimmed);
  }, [content]);

  if (!html) return null;

  const isComment = variant === "comment";

  return (
    <div
      className={cn(
        "markdown-body w-full max-w-none text-foreground",
        isComment
          ? "text-sm leading-normal [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-0.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5"
          : "text-sm leading-relaxed [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-xs",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
