interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

/** On/off switch in the Volca rocker style. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      className="tn-toggle"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{ background: "none", border: "none", padding: 0 }}
    >
      <span className="tn-toggle__switch" data-on={checked}>
        <span className="tn-toggle__knob" />
      </span>
      {label && <span className="tn-toggle__label">{label}</span>}
    </button>
  );
}
