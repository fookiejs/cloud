import { FookieCloudMark } from "@/components/FookieCloudMark";

export function BrandSplash(props: {
  title: string;
  subtitle?: string;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-1.5">
        <div className="text-lg font-semibold tracking-tight">{props.title}</div>
        {props.error ? (
          <p className="pt-1 text-sm text-destructive">{props.error}</p>
        ) : props.subtitle ? (
          <p className="text-xs text-muted-foreground">{props.subtitle}</p>
        ) : null}
      </div>
      {props.onRetry ? (
        <button type="button" className="text-sm text-primary underline" onClick={props.onRetry}>
          Try again
        </button>
      ) : null}
      <FookieCloudMark size="sm" />
    </div>
  );
}
