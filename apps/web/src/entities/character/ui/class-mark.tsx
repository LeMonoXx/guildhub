import { classGlyph } from "../model/class-glyphs";
import { wowClassColorVar } from "../model/class-color";

interface ClassMarkProps {
  readonly classId: string;
}

export function ClassMark({ classId }: ClassMarkProps) {
  const glyph = classGlyph(classId);
  return (
    <svg
      className="wow-mark"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ color: wowClassColorVar(classId) }}
    >
      {glyph.circles?.map((circle) => (
        <circle
          key={`${String(circle.cx)}-${String(circle.cy)}`}
          cx={circle.cx}
          cy={circle.cy}
          r={circle.r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      ))}
      {glyph.paths.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
