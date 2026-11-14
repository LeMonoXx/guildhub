import type { ReactNode } from "react";
import { Reveal } from "./reveal";

interface PanelSectionProps {
  readonly id: string;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly lead?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/** A page section with the ornamented heading used across the portal. */
export function PanelSection({
  id,
  eyebrow,
  title,
  lead,
  children,
  className,
}: PanelSectionProps) {
  return (
    <section
      id={id}
      className={["panel-section", className].filter(Boolean).join(" ")}
      aria-labelledby={`${id}-title`}
    >
      <Reveal className="panel-heading">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={`${id}-title`}>
          <span className="ornament" aria-hidden="true" />
          {title}
          <span className="ornament ornament-end" aria-hidden="true" />
        </h2>
        {lead ? <p className="panel-lead">{lead}</p> : null}
      </Reveal>
      {children}
    </section>
  );
}
