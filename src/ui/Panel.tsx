import type { ReactNode } from "react";

type Texture = "none" | "dots" | "grille" | "brushed" | "diagonal";

interface PanelProps {
  title?: string;
  texture?: Texture;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Hardware-style panel container with optional surface texture. */
export function Panel({
  title,
  texture = "none",
  actions,
  children,
  className = "",
  style,
}: PanelProps) {
  const texClass = texture !== "none" ? `tex-${texture}` : "";
  return (
    <section className={`tn-panel ${texClass} ${className}`.trim()} style={style}>
      {(title || actions) && (
        <header className="tn-panel__head">
          {title && <h2 className="tn-panel__title">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
