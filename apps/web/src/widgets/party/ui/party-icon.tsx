import { partyIconUrl, type PartyIconName } from "../model/party-lookup";

interface PartyIconProps {
  readonly icon: PartyIconName;
  /** Read out when set; the icon is decoration otherwise. */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

export function PartyIcon({ icon, label, className }: PartyIconProps) {
  return (
    <img
      className={["party-icon", className].filter(Boolean).join(" ")}
      src={partyIconUrl(icon)}
      alt={label ?? ""}
      aria-hidden={label === undefined ? true : undefined}
      title={label}
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
    />
  );
}
