import type { HistoryEvent } from "@guildhub/contracts";
import { CharacterLink } from "./character-link";

export function HistoryName({
  event,
}: {
  readonly event: Pick<HistoryEvent, "slug" | "name" | "surname" | "classId">;
}) {
  return (
    <CharacterLink
      slug={event.slug}
      classId={event.classId}
      title={`${event.name} ${event.surname}`}
    >
      {event.name}
    </CharacterLink>
  );
}
