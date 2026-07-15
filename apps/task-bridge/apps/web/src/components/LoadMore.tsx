import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoadMoreProps = {
  loaded: number;
  hasMore: boolean;
  loading: boolean | null;
  onLoadMore: () => void;
};

export function LoadMore(rawProps: Partial<LoadMoreProps> & Pick<LoadMoreProps, "loaded" | "hasMore" | "onLoadMore">) {
  let loading = false;
  if ("loading" in rawProps) {
    loading = rawProps.loading === true;
  }
  const { loaded, hasMore, onLoadMore } = rawProps;

  if (loaded === 0 && !hasMore) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted-foreground">{loaded} loaded</p>
      {hasMore ? (
        <Button variant="outline" size="sm" disabled={loading} onClick={onLoadMore}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Load more
        </Button>
      ) : loaded > 0 ? (
        <p className="text-xs text-muted-foreground">End of list</p>
      ) : null}
    </div>
  );
}
