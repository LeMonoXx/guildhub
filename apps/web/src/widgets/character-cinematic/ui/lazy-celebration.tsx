import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { characterQueries } from "../../../entities/character";
import { prefersReducedMotion, useInView } from "../../../shared/lib";

const CelebrationModel = lazy(() =>
  import("../../character-model").then((module) => ({
    default: module.CelebrationModel,
  })),
);

export interface LazyCelebrationProps {
  readonly slug: string;
  readonly assetBase: string;
  readonly className?: string;
}

/**
 * A member cheering, drawn only while on screen so a long timeline never
 * holds more than a few WebGL contexts. Nothing until their look is baked.
 */
export function LazyCelebration({
  slug,
  assetBase,
  className,
}: LazyCelebrationProps) {
  const [ref, visible] = useInView<HTMLDivElement>({
    once: false,
    rootMargin: "120px 0px",
  });
  const detail = useQuery({
    ...characterQueries.detail(slug),
    enabled: visible,
  });
  const manifestUrl =
    detail.data?.model.status === "ready"
      ? detail.data.model.manifestUrl
      : undefined;
  return (
    <div ref={ref} className="celebration-slot">
      {visible && manifestUrl !== undefined && !prefersReducedMotion() ? (
        <Suspense fallback={null}>
          <CelebrationModel
            manifestUrl={manifestUrl}
            assetBase={assetBase}
            className={className}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
