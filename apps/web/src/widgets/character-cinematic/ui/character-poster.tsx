import { useState } from "react";
import { FallbackImage, FigureSilhouette } from "../../../shared/ui";
import { measureFigureBounds, type FigureBounds } from "../lib/figure-bounds";

export function CharacterPoster({ src }: { readonly src: string | undefined }) {
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
