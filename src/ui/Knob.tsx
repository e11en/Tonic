import { useDragValue } from "./useDragValue";

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  label?: string;
  /** Formats the value shown under the dial. */
  format?: (value: number) => string;
  size?: number;
}

const START_ANGLE = -135;
const END_ANGLE = 135;

/** Rotary knob with a tick ring. Drag vertically to turn. */
export function Knob({
  value,
  min = 0,
  max = 1,
  onChange,
  label,
  format,
  size = 56,
}: KnobProps) {
  const drag = useDragValue({ value, min, max, onChange });
  const t = (value - min) / (max - min || 1);
  const angle = START_ANGLE + t * (END_ANGLE - START_ANGLE);
  const r = size / 2;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = ((START_ANGLE + (i / 10) * (END_ANGLE - START_ANGLE)) * Math.PI) / 180;
    const inner = r - 4;
    const outer = r - 1;
    return (
      <line
        key={i}
        x1={r + Math.sin(a) * inner}
        y1={r - Math.cos(a) * inner}
        x2={r + Math.sin(a) * outer}
        y2={r - Math.cos(a) * outer}
        stroke="var(--border-strong)"
        strokeWidth={1.5}
      />
    );
  });

  return (
    <div className="tn-knob">
      <svg
        className="tn-knob__dial"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
      >
        {ticks}
        <circle
          cx={r}
          cy={r}
          r={r - 8}
          fill="var(--surface-2)"
          stroke="var(--border-strong)"
          strokeWidth={1.5}
        />
        <g transform={`rotate(${angle} ${r} ${r})`}>
          <line
            x1={r}
            y1={r}
            x2={r}
            y2={10}
            stroke="var(--accent)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      </svg>
      {label && <span className="tn-knob__label">{label}</span>}
      {format && <span className="tn-knob__value">{format(value)}</span>}
    </div>
  );
}
