import { raceGlyph } from "../model/race-glyphs";

interface RaceMarkProps {
  readonly raceId: string;
}

export function RaceMark({ raceId }: RaceMarkProps) {
  const glyph = raceGlyph(raceId);
  return (
    <svg
      className="wow-mark wow-mark-muted"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {glyph.paths.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
