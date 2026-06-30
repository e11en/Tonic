type LedState = "off" | "on" | "warn" | "blink";

interface LedProps {
  state?: LedState;
  title?: string;
}

/** Tiny status indicator light. */
export function LED({ state = "off", title }: LedProps) {
  return <span className="tn-led" data-state={state} title={title} aria-label={title} />;
}
