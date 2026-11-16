import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";
import type { StatLine } from "../model/stat-lines";

export function StatCard({
  title,
  lines,
  delayMs,
}: {
  readonly title: string;
  readonly lines: readonly StatLine[];
  readonly delayMs: number;
}) {
  const { t, locale } = useLocale();
  return (
    <Reveal className="stat-card" delayMs={delayMs}>
      <h3>{title}</h3>
      <dl>
        {lines.map((line) => (
          <div key={line.key}>
            <dt>{t(`stat.${line.key}`)}</dt>
            <dd>
              {formatNumber(line.value, locale, line.digits ?? 0)}
              {line.suffix ?? ""}
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}
