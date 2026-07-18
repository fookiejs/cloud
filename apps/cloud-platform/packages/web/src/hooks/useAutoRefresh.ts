import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 10_000;

export function useAutoRefresh(
  refresh: (silent: boolean) => void | Promise<void>,
  options: {
    enabled?: boolean;
    intervalMs?: number;
  } = {},
) {
  const enabled = options.enabled !== false;
  const intervalMs =
    typeof options.intervalMs === "number" ? options.intervalMs : DEFAULT_INTERVAL_MS;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    void refreshRef.current(false);
    const timer = window.setInterval(() => {
      void refreshRef.current(true);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, refresh]);
}
