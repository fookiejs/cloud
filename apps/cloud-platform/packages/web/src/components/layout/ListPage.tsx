import { Input } from "@/components/ui/input";

// Shared shell for every simple project-scoped list (Notes, and future lists like
// it): header renders immediately and never gets swapped out, and there is no
// loading skeleton — the empty-state text doubles as the loading state, since items
// defaults to [] until data arrives. Keeps every list feeling the same instead of
// each screen inventing its own loading/empty/filter behavior.
export function ListPageHeader(props: {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex h-14 items-center gap-3 border-b px-6 py-5">
      <h1 className="text-sm font-semibold tracking-tight">{props.title}</h1>
      {props.badge}
      <div className="flex-1" />
      {props.actions}
    </div>
  );
}

export function ListBody<T>(props: {
  items: readonly T[];
  emptyText: string;
  keyOf: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  filterFn?: (item: T, query: string) => boolean;
  error?: string | null;
}): React.JSX.Element {
  const query = props.filterValue?.trim().toLowerCase() ?? "";
  const visible =
    query.length > 0 && props.filterFn !== undefined
      ? props.items.filter((item) => props.filterFn!(item, query))
      : props.items;

  return (
    <div className="p-6">
      {props.error !== null && props.error !== undefined ? (
        <p className="mb-4 text-sm text-destructive">{props.error}</p>
      ) : null}
      {props.onFilterChange !== undefined ? (
        <Input
          value={props.filterValue ?? ""}
          onChange={(e) => props.onFilterChange?.(e.target.value)}
          placeholder={props.filterPlaceholder ?? "Filter…"}
          className="mb-4 max-w-xs"
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.emptyText}</p>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-1">
          {visible.map((item) => (
            <li key={props.keyOf(item)}>{props.renderItem(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
