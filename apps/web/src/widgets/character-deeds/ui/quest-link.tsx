import type { QuestRef } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { wowheadUrl } from "../../../shared/lib";

export function QuestLink({
  quest,
  children,
}: {
  readonly quest: QuestRef;
  readonly children: string;
}) {
  const { locale } = useLocale();
  return (
    <a
      className="quest-link"
      href={wowheadUrl("quest", quest.id, locale)}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
