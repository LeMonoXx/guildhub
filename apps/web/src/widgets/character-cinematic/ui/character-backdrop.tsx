import type { CharacterDetailResponse } from "@guildhub/contracts";
import { useMemo } from "react";
import {
  bakeStatus,
  raceHeight,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { liveStageMediaQuery, useMediaQuery } from "../../../shared/lib";
import { LoadProgress } from "../../../shared/ui";
import { buildCharacterIdleScene } from "../model/build-idle-scene";
import { CharacterPoster } from "./character-poster";
import { LiveCharacterStage } from "./live-character-stage";

/** The character's render as a poster, replaced by the live model where the device can carry it. */
export function CharacterBackdrop({
  detail,
}: {
  readonly detail: CharacterDetailResponse;
}) {
  const { t } = useLocale();
  const liveCapable = useMediaQuery(liveStageMediaQuery);
  const live = liveCapable && detail.model.status === "ready";
  const baking = liveCapable && detail.model.status === "pending";
  const bake = baking ? bakeStatus(detail.model.bake, t) : undefined;
  const figureHeight = raceHeight(detail.raceId);
  const scene = useMemo(
    () =>
      buildCharacterIdleScene({
        id: detail.slug,
        manifest: detail.lookManifest,
        figureHeight,
        framing: "bust",
      }),
    [detail.slug, detail.lookManifest, figureHeight],
  );
  return (
    <div
      className="character-backdrop"
      data-live={live}
      style={{ ["--hero-class" as string]: wowClassColorVar(detail.classId) }}
    >
      <div className="character-backdrop-frame">
        <div className="character-backdrop-glow" aria-hidden="true" />
        <CharacterPoster key={detail.renderUrl} src={detail.renderUrl} />
        {live ? (
          <LiveCharacterStage
            scene={scene}
            fitToActorHeight={figureHeight}
            manifest={detail.lookManifest}
            assetBase="/assets/"
            variant="embedded"
            ariaLabel={t("character.stageLabel")}
          />
        ) : null}
        {baking ? (
          <div className="model-loading">
            <LoadProgress
              label={bake?.label ?? t("model.baking")}
              fraction={bake?.fraction}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
