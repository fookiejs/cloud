import { useEffect, useRef, useState } from 'react';
import type { ExecutionStatus } from '@/types';

export function useStatusFlash(
  statusKey: ExecutionStatus | 'idle',
): ExecutionStatus | 'idle' | null {
  const prev = useRef<ExecutionStatus | 'idle' | null>(null);
  const [flash, setFlash] = useState<ExecutionStatus | 'idle' | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = statusKey;
      return;
    }
    if (prev.current === statusKey) {
      return;
    }
    prev.current = statusKey;
    setFlash(statusKey);
    const timer = window.setTimeout(() => {
      setFlash(null);
    }, 1400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [statusKey]);

  return flash;
}
