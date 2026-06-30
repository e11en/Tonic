import { useDragValue } from "./useDragValue";

interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  /** Formats the value shown below the track. */
  format?: (value: number) => string;
  height?: number;
}

/** Vertical mixer fader. Drag the cap up/down. */
export function Fader({
  value,
  min = -60,
  max = 6,
  onChange,
  format,
  height = 160,
}: FaderProps) {
  const drag = useDragValue({ value, min, max, onChange, range: height });
  const t = (value - min) / (max - min || 1);
  // cap travels within the padded slot (10px top/bottom)
  const top = 10 + (1 - t) * (height - 20);

  return (
    <div className="tn-fader">
      <div
        className="tn-fader__track"
        style={{ height }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
      >
        <div className="tn-fader__slot" />
        <div className="tn-fader__cap" style={{ top }} />
      </div>
      {format && <span className="tn-fader__value">{format(value)}</span>}
    </div>
  );
}
