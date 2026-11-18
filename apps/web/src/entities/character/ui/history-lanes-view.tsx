import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "../../../shared/i18n";
import { useDragScroll } from "../../../shared/lib";
import type { HistoryEventOf } from "../model/history-event";
import {
  featuredMark,
  type HistoryLanes,
  type LaneMark,
} from "../model/history-lanes";
import { DEFAULT_LANE_ZOOM, LANE_ZOOMS, laneScale } from "../model/lane-scale";
import { HistoryLaneRow } from "./history-lane";
import { LaneAxis, LaneGrid } from "./lane-axis";
import { LaneDetail } from "./lane-detail";

interface HistoryLanesViewProps {
  readonly lanes: HistoryLanes;
  /** A member cheering beside their level-up; nothing when absent. */
  readonly renderCelebration?: (event: HistoryEventOf<"level">) => ReactNode;
}

/** Where along the lanes the middle of the view is, from 0 to 1. */
const centerOf = (viewport: HTMLElement) =>
  (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;

/** Every member on their own lane, time running to the right. */
export function HistoryLanesView({
  lanes,
  renderCelebration,
}: HistoryLanesViewProps) {
  const { t } = useLocale();
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<number>(1);
  const [zoom, setZoom] = useState(DEFAULT_LANE_ZOOM);
  const [pinned, setPinned] = useState<LaneMark>();
  const [preview, setPreview] = useState<LaneMark>();
  useDragScroll(viewport);
  const scale = useMemo(
    () => laneScale(lanes.from, lanes.to, LANE_ZOOMS[zoom] ?? 24),
    [lanes, zoom],
  );
  const shown = preview ?? pinned ?? featuredMark(lanes);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    element.scrollLeft =
      anchor.current * element.scrollWidth - element.clientWidth / 2;
  }, [scale]);

  const zoomTo = (next: number) => {
    if (viewport.current) anchor.current = centerOf(viewport.current);
    setZoom(Math.min(LANE_ZOOMS.length - 1, Math.max(0, next)));
  };

  return (
    <div
      className="lanes"
      onMouseLeave={() => {
        setPreview(undefined);
      }}
    >
      <div className="lanes-toolbar">
        <p className="lanes-hint">{t("lanes.hint")}</p>
        <div className="lanes-zoom" role="group" aria-label={t("lanes.zoom")}>
          <button
            type="button"
            aria-label={t("lanes.zoomOut")}
            disabled={zoom === 0}
            onClick={() => {
              zoomTo(zoom - 1);
            }}
          >
            −
          </button>
          <button
            type="button"
            aria-label={t("lanes.zoomIn")}
            disabled={zoom === LANE_ZOOMS.length - 1}
            onClick={() => {
              zoomTo(zoom + 1);
            }}
          >
            +
          </button>
        </div>
      </div>
      <div className="lanes-viewport" ref={viewport}>
        <div
          className="lanes-canvas"
          style={{ ["--lanes-width" as string]: `${String(scale.width)}px` }}
        >
          <LaneAxis scale={scale} />
          <div className="lanes-rows">
            <LaneGrid scale={scale} />
            {lanes.lanes.map((lane) => (
              <HistoryLaneRow
                key={lane.member.slug}
                lane={lane}
                scale={scale}
                selectedKey={shown?.key}
                onPreview={setPreview}
                onPin={setPinned}
              />
            ))}
          </div>
        </div>
      </div>
      {shown ? (
        <LaneDetail
          key={shown.key}
          mark={shown}
          renderCelebration={renderCelebration}
        />
      ) : null}
    </div>
  );
}
