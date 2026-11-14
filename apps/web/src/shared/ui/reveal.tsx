import type { ReactNode } from "react";
import { useInView } from "../lib/motion";

interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly delayMs?: number | undefined;
  readonly as?: "div" | "li" | "article";
}

/** Fades and lifts its content in when it scrolls into view. */
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: RevealProps) {
  const [ref, visible] = useInView<HTMLDivElement & HTMLLIElement>();
  return (
    <Tag
      ref={ref}
      className={["reveal", className].filter(Boolean).join(" ")}
      data-visible={visible}
      style={{ ["--reveal-delay" as string]: `${String(delayMs)}ms` }}
    >
      {children}
    </Tag>
  );
}
