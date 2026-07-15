import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className: string | null;
  compact: boolean;
  linkTo: string | null;
};

export function BrandMark(rawProps: Partial<BrandMarkProps> = {}) {
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  let compact = false;
  if ("compact" in rawProps && rawProps.compact === true) {
    compact = true;
  }
  let linkTo: string | null = "/projects";
  if ("linkTo" in rawProps) {
    if (rawProps.linkTo === null) {
      linkTo = null;
    } else if (typeof rawProps.linkTo === "string") {
      linkTo = rawProps.linkTo;
    }
  }

  const location = useLocation();
  const href = linkTo;
  const inner = (
    <p className={cn("font-semibold tracking-tight", compact ? "text-sm" : "text-base")}>
      Task Bridge
    </p>
  );

  if (!href) {
    return <div className={cn("flex items-center", className)}>{inner}</div>;
  }

  let linkState: { from: string } | null = null;
  if (location.pathname.startsWith("/projects/")) {
    linkState = { from: location.pathname };
  }

  return (
    <Link
      to={href}
      state={linkState}
      className={cn(
        "flex items-center rounded-lg transition-colors hover:bg-white/[0.04]",
        compact ? "-mx-1 px-1 py-0.5" : "px-1 py-0.5",
        className,
      )}
    >
      {inner}
    </Link>
  );
}
