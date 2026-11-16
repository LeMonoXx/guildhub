import type { CharacterProfileResponse } from "@guildhub/contracts";
import { DeedsAchievements } from "./deeds-achievements";
import { DeedsJourney } from "./deeds-journey";
import { DeedsStatistics } from "./deeds-statistics";

export function CharacterDeeds({
  profile,
}: {
  readonly profile: CharacterProfileResponse;
}) {
  return (
    <div className="deeds">
      <DeedsAchievements achievements={profile.achievements} />
      <DeedsJourney profile={profile} />
      <DeedsStatistics statisticGroups={profile.statisticGroups} />
    </div>
  );
}
