import { useEffect, useState } from 'react';

export function useTick(ms: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, ms);
    return () => {
      window.clearInterval(id);
    };
  }, [ms, active]);

  return now;
}
