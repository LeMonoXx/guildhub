import type { PartyMember } from "@guildhub/contracts";
import { ClassMark, wowClassColorVar } from "../../../entities/character";
import { FallbackImage } from "../../../shared/ui";

interface MemberAvatarProps {
  readonly member: PartyMember;
  readonly className?: string | undefined;
}

/** The armory portrait in a ring of the member's class colour. */
export function MemberAvatar({ member, className }: MemberAvatarProps) {
  return (
    <span
      className={["party-avatar", className].filter(Boolean).join(" ")}
      style={{ ["--class-color" as string]: wowClassColorVar(member.classId) }}
      aria-hidden="true"
    >
      <FallbackImage
        src={member.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        fallback={<ClassMark classId={member.classId} />}
      />
      <span className="party-avatar-level">{member.level}</span>
    </span>
  );
}
