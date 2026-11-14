import type { FeaturedMember } from "@guildhub/contracts";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { FrameDecorator } from "../../../cinematic";
import { arrangeTroop } from "./arrange-troop";
import { buildLineupScene } from "./build-lineup-scene";
import { LineupChoreography } from "./lineup-choreography";
import { LineupFraming } from "./lineup-framing";

const featuredLimit = 6;

/** The lineup scene plus who is selected, and where everyone stands for it. */
export const useLineupStage = (members: readonly FeaturedMember[]) => {
  const cast = useMemo(() => members.slice(0, featuredLimit), [members]);
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
    scene,
    decorators,
    framing,
    assembled,
    selected,
    plan,
    toggle,
  };
};
