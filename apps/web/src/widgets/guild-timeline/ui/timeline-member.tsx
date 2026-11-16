import { CharacterLink } from "../../../entities/character";
import type { TimelineEvent } from "../model/timeline-entries";

export function TimelineMember({ event }: { readonly event: TimelineEvent }) {
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
