import { useCallback, useRef } from "react";

interface DragOptions {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Pixels of vertical drag to traverse the full range. Default 200. */
  range?: number;
}

/**
 * Vertical-drag interaction shared by Knob and Fader.
 * Drag up = increase, drag down = decrease. Returns an onPointerDown handler.
 */
export function useDragValue({ value, min, max, onChange, range = 200 }: DragOptions) {
  const start = useRef<{ y: number; value: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      start.current = { y: e.clientY, value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      const dy = start.current.y - e.clientY;
      const span = max - min;
      const next = start.current.value + (dy / range) * span;
      onChange(Math.min(max, Math.max(min, next)));
    },
    [min, max, range, onChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    start.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
