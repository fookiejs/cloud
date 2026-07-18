import { useEffect, useState } from 'react';

export function useStableRunning(isRunning: boolean, holdMs: number): boolean {
  const [stable, setStable] = useState(isRunning);

  useEffect(() => {
    if (isRunning) {
      setStable(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setStable(false);
    }, holdMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isRunning, holdMs]);

  return stable;
}
