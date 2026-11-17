import type { PartyMember } from "@guildhub/contracts";
import { CharacterLink } from "../../../entities/character";
import { MemberAvatar } from "./member-avatar";

interface MemberChipProps {
  readonly member: PartyMember;
  readonly highlighted?: boolean;
}

export function MemberChip({ member, highlighted = false }: MemberChipProps) {
  return (
    <span className="party-chip" data-highlighted={highlighted}>
      <MemberAvatar member={member} />
      <CharacterLink
        slug={member.slug}
        classId={member.classId}
        title={`${member.name} ${member.surname}`}
      >
        {member.name}
      </CharacterLink>
    </span>
  );
}
