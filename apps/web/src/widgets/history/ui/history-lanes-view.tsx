import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useLocale } from "../../../shared/i18n";
import { useDragScroll } from "../../../shared/lib";
import {
  featuredMark,
  type HistoryLanes,
  type LaneMark,
} from "../model/history-lanes";
import { stepFrom, stepOf } from "../model/lane-navigation";
import { DEFAULT_LANE_ZOOM, LANE_ZOOMS, laneScale } from "../model/lane-scale";
import { HistoryLaneRow } from "./history-lane";
import { LaneAxis, LaneGrid } from "./lane-axis";
import { LaneDetail, type RenderCelebration } from "./lane-detail";

interface HistoryLanesViewProps {
  readonly lanes: HistoryLanes;
  /** A member cheering beside their level-up; nothing when absent. */
  readonly renderCelebration?: RenderCelebration;
}

/** Where along the lanes the middle of the view is, from 0 to 1. */
const centerOf = (viewport: HTMLElement) =>
  (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth;

const markButton = (viewport: HTMLElement | null, key: string) =>
  [...(viewport?.querySelectorAll<HTMLElement>(".lane-mark") ?? [])].find(
    (button) => button.dataset.mark === key,
  );

/** Every member on their own lane, time running to the right. */
export function HistoryLanesView({
  lanes,
  renderCelebration,
}: HistoryLanesViewProps) {
  const { t } = useLocale();
  const viewport = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | undefined>(undefined);
  const [zoom, setZoom] = useState(DEFAULT_LANE_ZOOM);
  const [pinned, setPinned] = useState<LaneMark>();
  const [preview, setPreview] = useState<LaneMark>();
  useDragScroll(viewport);
  // The scroll effect runs whenever these change identity, so they must not on hover.
  const featured = useMemo(() => featuredMark(lanes), [lanes]);
  const scale = useMemo(
    () => laneScale(lanes.from, lanes.to, LANE_ZOOMS[zoom] ?? 24),
    [lanes, zoom],
  );
  const shown = preview ?? pinned ?? featured;
  const tabStop = pinned ?? featured;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const at =
      anchor.current ?? (featured ? scale.x(featured.at) / scale.width : 1);
    element.scrollLeft = at * element.scrollWidth - element.clientWidth / 2;
  }, [scale, featured]);

  const zoomTo = (next: number) => {
    if (viewport.current) anchor.current = centerOf(viewport.current);
    setZoom(Math.min(LANE_ZOOMS.length - 1, Math.max(0, next)));
  };

  const move = (event: KeyboardEvent<HTMLElement>) => {
    const step = stepOf(event.key);
    const from = (event.target as HTMLElement).dataset.mark;
    if (step === undefined || from === undefined) return;
    const to = stepFrom(lanes, from, step);
    if (!to) return;
    event.preventDefault();
    markButton(viewport.current, to.key)?.focus();
  };

  const leave = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget))
      setPreview(undefined);
  };

  return (
    <div className="lanes">
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
      <div
        className="lanes-viewport"
        ref={viewport}
        role="toolbar"
        aria-label={t("lanes.members")}
        onKeyDown={move}
        onMouseLeave={() => {
          setPreview(undefined);
        }}
        onBlur={leave}
      >
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
                tabStopKey={tabStop?.key}
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
