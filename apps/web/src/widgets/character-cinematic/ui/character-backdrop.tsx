import type { CharacterDetailResponse } from "@guildhub/contracts";
import { useMemo, useState } from "react";
import {
  bakeStatus,
  raceHeight,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import {
  liveStageMediaQuery,
  measureFigureBounds,
  useMediaQuery,
  type FigureBounds,
} from "../../../shared/lib";
import {
  FallbackImage,
  FigureSilhouette,
  LoadProgress,
} from "../../../shared/ui";
import { buildCharacterIdleScene } from "../model/build-idle-scene";
import { LiveCharacterStage } from "./live-character-stage";

function CharacterPoster({ src }: { readonly src: string | undefined }) {
  const [figure, setFigure] = useState<FigureBounds | undefined>();
  const style = figure && {
    ["--figure-top" as string]: String(figure.top),
    ["--figure-height" as string]: String(figure.bottom - figure.top),
    ["--figure-center" as string]: String((figure.left + figure.right) / 2),
  };
  return (
    <FallbackImage
      className="character-poster"
      src={src}
      fallback={<FigureSilhouette className="character-silhouette" />}
      data-framed={figure !== undefined}
      style={style}
      onLoad={(event) => {
        setFigure(measureFigureBounds(event.currentTarget));
      }}
    />
  );
}

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
