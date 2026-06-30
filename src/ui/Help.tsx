import { useState } from "react";

interface HelpProps {
  /** Short bold heading shown in the popover. */
  title: string;
  /** Plain-language explanation aimed at beginners. */
  children: React.ReactNode;
}

/**
 * Inline "explain this" button — core to Tonic's beginner focus.
 * Click the "?" to reveal a plain-language tooltip.
 */
export function Help({ title, children }: HelpProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tn-help">
      <button
        type="button"
        className="tn-help__btn"
        aria-expanded={open}
        aria-label={`Help: ${title}`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span className="tn-help__pop" role="tooltip">
          <strong>{title}</strong>
          {children}
        </span>
      )}
    </span>
  );
}
