import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; to: string | null };

type PageHeaderProps = {
  breadcrumb: Crumb[] | null;
  title: string;
  subtitle: string | null;
  actions: ReactNode | null;
  className: string | null;
};

export function PageHeader(rawProps: Partial<PageHeaderProps> & Pick<PageHeaderProps, "title">) {
  let breadcrumb: Crumb[] | null = null;
  if ("breadcrumb" in rawProps) {
    if (rawProps.breadcrumb === null) {
      breadcrumb = null;
    } else if (Array.isArray(rawProps.breadcrumb)) {
      breadcrumb = rawProps.breadcrumb;
    }
  }
  let subtitle: string | null = null;
  if ("subtitle" in rawProps) {
    if (rawProps.subtitle === null) {
      subtitle = null;
    } else if (typeof rawProps.subtitle === "string") {
      subtitle = rawProps.subtitle;
    }
  }
  let actions: ReactNode | null = null;
  if ("actions" in rawProps && rawProps.actions !== null) {
    actions = rawProps.actions;
  }
  let className: string | null = null;
  if ("className" in rawProps) {
    if (rawProps.className === null) {
      className = null;
    } else if (typeof rawProps.className === "string") {
      className = rawProps.className;
    }
  }
  const { title } = rawProps;

  return (
    <div className={cn("page-toolbar flex-wrap", className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
        <h1 className="truncate text-lg font-semibold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {item.to && !isLast ? (
              <Link to={item.to} className="max-w-[12rem] truncate transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={cn("max-w-[12rem] truncate", isLast && "text-foreground")}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
