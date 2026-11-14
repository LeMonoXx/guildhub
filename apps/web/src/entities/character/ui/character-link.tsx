import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ClassColoredName } from "./class-colored-name";

interface CharacterLinkProps {
  readonly slug: string;
  readonly classId: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** Full name on hover; first names repeat across a guild. */
  readonly title?: string | undefined;
}

export function CharacterLink({
  slug,
  classId,
  children,
  className,
  title,
}: CharacterLinkProps) {
  return (
    <ClassColoredName classId={classId}>
      <Link
        to="/characters/$characterSlug"
        params={{ characterSlug: slug }}
        className={["character-link", className].filter(Boolean).join(" ")}
        title={title}
      >
        {children}
      </Link>
    </ClassColoredName>
  );
}
