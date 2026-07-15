import { useCallback, useEffect, useRef, useState } from 'react';

function readStored(key: string, fallback: number): number {
  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    return fallback;
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n;
}

interface Options {
  storageKey: string;
  initial: number;
  min: number;
  max: number;
}

export function useDragResize(opts: Options): {
  size: number;
  dragging: boolean;
  onHandleMouseDown(e: React.MouseEvent): void;
} {
  const [size, setSize] = useState(() => readStored(opts.storageKey, opts.initial));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startSize: number } | null>(null);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag === null) {
        return;
      }
      const delta = drag.startX - e.clientX;
      let next = drag.startSize + delta;
      if (next < opts.min) {
        next = opts.min;
      }
      if (next > opts.max) {
        next = opts.max;
      }
      setSize(next);
    },
    [opts.min, opts.max],
  );

  const onUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMove, onUp]);

  useEffect(() => {
    window.localStorage.setItem(opts.storageKey, String(size));
  }, [opts.storageKey, size]);

  function onHandleMouseDown(e: React.MouseEvent): void {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startSize: size };
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return { size, dragging, onHandleMouseDown };
}

interface SplitOptions {
  storageKey: string;
  initial: number;
  minLeft: number;
  minRight: number;
}

export function useDragSplit(
  containerRef: React.RefObject<HTMLElement | null>,
  opts: SplitOptions,
): {
  leftWidth: number;
  dragging: boolean;
  onHandleMouseDown(e: React.MouseEvent): void;
} {
  const [leftWidth, setLeftWidth] = useState(() => readStored(opts.storageKey, opts.initial));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startLeft: number } | null>(null);

  const onMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      const el = containerRef.current;
      if (drag === null || el === null) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const total = rect.width;
      const maxLeft = total - opts.minRight;
      let next = drag.startLeft + (e.clientX - drag.startX);
      if (next < opts.minLeft) {
        next = opts.minLeft;
      }
      if (next > maxLeft) {
        next = maxLeft;
      }
      setLeftWidth(next);
    },
    [containerRef, opts.minLeft, opts.minRight],
  );

  const onUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMove, onUp]);

  useEffect(() => {
    window.localStorage.setItem(opts.storageKey, String(leftWidth));
  }, [opts.storageKey, leftWidth]);

  function onHandleMouseDown(e: React.MouseEvent): void {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startLeft: leftWidth };
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return { leftWidth, dragging, onHandleMouseDown };
}
