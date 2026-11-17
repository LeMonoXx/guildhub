import type { PartyDungeon } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import type { MapPoint } from "../model/map-layout";
import { PartyIcon } from "./party-icon";

interface MapPortalProps {
  readonly dungeon: PartyDungeon;
  readonly point: MapPoint;
  readonly order: number;
  readonly lit: boolean;
  readonly onHover: (on: boolean) => void;
  readonly onSelect: () => void;
}

/** A dungeon entrance: a swirling portal that burns brighter the closer its group is to complete. */
export function MapPortal({
  dungeon,
  point,
  order,
  lit,
  onHover,
  onSelect,
}: MapPortalProps) {
  const { t } = useLocale();
  const name = t(`dungeon.${dungeon.key}`);
  const ready = dungeon.missing.length === 0;
  const hover = (on: boolean) => () => {
    onHover(on);
  };
  return (
    <button
      type="button"
      className="party-portal-marker"
      data-ready={ready}
      data-lit={lit}
      style={{
        left: `${String(point.x * 100)}%`,
        top: `${String(point.y * 100)}%`,
        ["--order" as string]: String(order),
      }}
      aria-label={t("party.portalLabel", {
        name,
        count: dungeon.members.length,
      })}
      onClick={onSelect}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      onFocus={hover(true)}
      onBlur={hover(false)}
    >
      <span className="party-portal-body">
        <span className="party-portal-ring" aria-hidden="true" />
        <span
          className="party-portal-ring party-portal-ring-outer"
          aria-hidden="true"
        />
        <PartyIcon icon="portal" />
        <span className="party-portal-count" aria-hidden="true">
          {dungeon.members.length}
        </span>
        <span className="party-portal-name" aria-hidden="true">
          {name}
        </span>
      </span>
    </button>
  );
}
