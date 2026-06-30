import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "neutral" | "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: boolean;
  children: ReactNode;
}

/** Skeuomorphic push button. */
export function Button({
  variant = "neutral",
  icon = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "tn-btn",
    variant === "primary" && "tn-btn--primary",
    variant === "ghost" && "tn-btn--ghost",
    icon && "tn-btn--icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
