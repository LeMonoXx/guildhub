import type { ReactNode } from "react";
import { Reveal } from "../../../shared/ui";

export function CollectionShelf({
  title,
  count,
  children,
  delayMs,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
  readonly delayMs: number;
}) {
  return (
    <Reveal className="collection-shelf" delayMs={delayMs} as="article">
      <header>
        <h3>{title}</h3>
        <span className="collection-count">{count}</span>
      </header>
      {children}
    </Reveal>
  );
}
