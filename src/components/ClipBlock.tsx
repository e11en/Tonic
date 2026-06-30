import { useRef } from "react";
import { moveClip, removeClip } from "@/state/actions";
import type { Clip } from "@/state/types";

interface ClipBlockProps {
  trackId: string;
  clip: Clip;
  label: string;
  color: string;
  pxPerSec: number;
  /** Override double-click (e.g. open the piano roll for MIDI clips). Defaults to remove. */
  onOpen?: () => void;
}

/**
 * A clip on the timeline. Drag horizontally to move it (→ `moveClip`), double-click
 * to remove it. Position/size derive purely from the store, so MCP moves animate too.
 */
export function ClipBlock({ trackId, clip, label, color, pxPerSec, onOpen }: ClipBlockProps) {
  const drag = useRef<{ startX: number; startSec: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startSec: clip.startSec };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const deltaSec = (e.clientX - drag.current.startX) / pxPerSec;
    moveClip(trackId, clip.id, drag.current.startSec + deltaSec);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  return (
    <div
      className="tn-clip"
      style={{
        left: clip.startSec * pxPerSec,
        width: Math.max(24, clip.durationSec * pxPerSec),
        ["--track-color" as string]: color,
      }}
      title={
        onOpen
          ? `${label} — drag to move, double-click to edit notes`
          : `${label} — drag to move, double-click to remove`
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => (onOpen ? onOpen() : removeClip(trackId, clip.id))}
    >
      <span className="tn-clip__label">{label}</span>
    </div>
  );
}
