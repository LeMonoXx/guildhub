import { useCountUp, useInView } from "../lib/motion";

interface CountUpProps {
  readonly value: number;
  readonly locale: string;
  readonly fractionDigits?: number;
  readonly durationMs?: number;
}

/** A number that counts up the first time it scrolls into view. */
export function CountUp({
  value,
  locale,
  fractionDigits = 0,
  durationMs,
}: CountUpProps) {
  const [ref, visible] = useInView<HTMLSpanElement>();
  const shown = useCountUp(value, visible, durationMs);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return (
    <span ref={ref} className="count-up">
      <span aria-hidden="true">{format.format(shown)}</span>
      <span className="visually-hidden">{format.format(value)}</span>
    </span>
  );
}
