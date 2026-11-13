import type { ReactNode } from "react";
import { wowClassColorVar } from "../model/class-color";

interface ClassColoredNameProps {
  readonly classId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function ClassColoredName({
  classId,
  children,
  className,
}: ClassColoredNameProps) {
  return (
    <span className={className} style={{ color: wowClassColorVar(classId) }}>
      {children}
    </span>
  );
}
