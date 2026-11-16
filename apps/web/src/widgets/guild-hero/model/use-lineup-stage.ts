import type { FeaturedMember } from "@guildhub/contracts";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { FrameDecorator } from "../../../shared/cinematic";
import { arrangeTroop } from "./arrange-troop";
import { buildLineupScene } from "./build-lineup-scene";
import { LineupChoreography } from "./lineup-choreography";
import { LineupFraming } from "./lineup-framing";

const featuredLimit = 6;

/** Everything about a member the stage is built from; bake news is not part of it. */
const stageKeyOf = (member: FeaturedMember): string =>
  JSON.stringify({
    ...member,
    model: member.model && { ...member.model, bake: undefined },
  });

/**
 * Keeps the cast while only bake progress changes, so polling a bake does
 * not restart the lineup.
 */
const useStageCast = (
  members: readonly FeaturedMember[],
): readonly FeaturedMember[] => {
  const latest = members.slice(0, featuredLimit);
  const key = latest.map(stageKeyOf).join("\n");
  const [stage, setStage] = useState({ key, cast: latest });
  if (stage.key !== key) {
    setStage({ key, cast: latest });
    return latest;
  }
  return stage.cast;
};

/** The lineup scene plus who is selected, and where everyone stands for it. */
export const useLineupStage = (members: readonly FeaturedMember[]) => {
  const cast = useStageCast(members);
  const bakes = useMemo(
    () =>
      new Map(
        members.flatMap((member) =>
          member.model?.status === "pending"
            ? [[member.slug, member.model.bake] as const]
            : [],
        ),
      ),
    [members],
  );
  const places = useMemo(() => arrangeTroop(cast), [cast]);
  const scene = useMemo(() => buildLineupScene(cast), [cast]);
  const choreography = useMemo(() => new LineupChoreography(places), [places]);
  const framing = useMemo(() => new LineupFraming(places), [places]);
  const decorators = useMemo<readonly FrameDecorator[]>(
    () => [choreography, framing],
    [choreography, framing],
  );
  const assembled = useSyncExternalStore(
    choreography.subscribe,
    () => choreography.isAssembled,
    () => false,
  );
  const [selected, setSelected] = useState<string>();
  const plan = useMemo(
    () => choreography.planFor(selected),
    [choreography, selected],
  );

  useEffect(() => {
    choreography.select(selected);
  }, [choreography, selected]);

  const toggle = useCallback((slug: string | undefined) => {
    setSelected((current) => (slug === current ? undefined : slug));
  }, []);

  return {
    places,
    bakes,
    scene,
    decorators,
    framing,
    assembled,
    selected,
    plan,
    toggle,
  };
};
