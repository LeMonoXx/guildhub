import type { GuildChronicleResponse } from "@guildhub/contracts";
import { wowClassColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { useInView } from "../../../shared/lib";

/** Each class's share of the guild as one slice of a conic gradient. */
const ringStops = (classes: GuildChronicleResponse["classes"]): string[] => {
  const total = classes.reduce((sum, entry) => sum + entry.count, 0) || 1;
  let cursor = 0;
  return classes.map((entry) => {
    const from = cursor;
    cursor += (entry.count / total) * 100;
    return `${wowClassColorVar(entry.key)} ${String(from)}% ${String(cursor)}%`;
  });
};

export function ClassRing({
  classes,
}: {
  readonly classes: GuildChronicleResponse["classes"];
}) {
  const { t } = useLocale();
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="class-ring"
      data-visible={visible}
      role="img"
      aria-label={classes
        .map((entry) => `${t(`class.${entry.key}`)}: ${String(entry.count)}`)
        .join(", ")}
      style={{
        ["--ring" as string]: `conic-gradient(${ringStops(classes).join(", ")})`,
      }}
    >
      <span className="class-ring-total">
        {classes.length}
        <small>{t("composition.classes")}</small>
      </span>
    </div>
  );
}
