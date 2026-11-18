import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { characterQueries } from "../../../entities/character";
import { useInView, useMediaQuery } from "../../../shared/lib";

const CelebrationModel = lazy(() =>
  import("../../character-model").then((module) => ({
    default: module.CelebrationModel,
  })),
);

export interface LazyCelebrationProps {
  readonly slug: string;
  /** The member's baked look when the page already knows it; asked for otherwise. */
  readonly manifestUrl?: string | undefined;
  readonly assetBase: string;
  readonly className?: string;
}

/**
 * A member cheering, drawn only while on screen and only for those who allow
 * motion. Nothing until their look is baked.
 */
export function LazyCelebration({
  slug,
  manifestUrl: known,
  assetBase,
  className,
}: LazyCelebrationProps) {
  const [ref, visible] = useInView<HTMLDivElement>({
    once: false,
    rootMargin: "120px 0px",
  });
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const wanted = visible && !still;
  const detail = useQuery({
    ...characterQueries.detail(slug),
    enabled: wanted && known === undefined,
  });
  const asked =
    detail.data?.model.status === "ready"
      ? detail.data.model.manifestUrl
      : undefined;
  const manifestUrl = known ?? asked;
  return (
    <div ref={ref} className="celebration-slot">
      {wanted && manifestUrl !== undefined ? (
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
