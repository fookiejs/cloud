import { useLayoutEffect, useRef, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExpandableMarkdownProps = {
  content: string;
  collapsedMaxHeight: number | null;
  className: string | null;
};

export function ExpandableMarkdown(rawProps: Partial<ExpandableMarkdownProps> & { content: string }) {
  let collapsedMaxHeight = 168;
  if ("collapsedMaxHeight" in rawProps && typeof rawProps.collapsedMaxHeight === "number") {
    collapsedMaxHeight = rawProps.collapsedMaxHeight;
  }
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  const { content } = rawProps;

  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    setCanExpand(node.scrollHeight > collapsedMaxHeight + 1);
  }, [content, collapsedMaxHeight]);

  let bodyStyle: { maxHeight: number } | null = null;
  if (!expanded && canExpand) {
    bodyStyle = { maxHeight: collapsedMaxHeight };
  }

  return (
    <div className={cn(className)}>
      <div
        ref={bodyRef}
        className={cn(!expanded && canExpand && "overflow-hidden")}
        style={bodyStyle !== null ? bodyStyle : {}}
      >
        <MarkdownView content={content} />
      </div>
      {canExpand ? (
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto px-0 text-sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  );
}
