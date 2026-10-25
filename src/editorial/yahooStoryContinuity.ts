import type { ApprovedYahooStory } from "./yahooStoryHistory.js";
import type { YahooPowerRanking } from "../rankings/yahooPowerRankings.js";

type StoryContext = Pick<
  ApprovedYahooStory,
  "week" | "rankings" | "nextWeekTeaser"
>;

type RankedTeam = Pick<
  YahooPowerRanking,
  "id" | "team" | "rank" | "powerScore"
>;

export function buildYahooStoryCallback(
  approvedHistory: readonly StoryContext[],
  previousRankings: readonly RankedTeam[] | null,
  currentRankings: readonly RankedTeam[],
  currentWeek: number,
): string | null {
  if (!previousRankings || currentWeek <= 1) {
    return null;
  }

  // Only continue a storyline from the immediately
  // preceding approved report.
  const previousStory = approvedHistory.find(
    (story) => story.week === currentWeek - 1,
  );

  if (!previousStory) return null;

  const previousLeader = previousRankings.find(
    (team) => team.rank === 1,
  );

  const currentLeader = currentRankings.find(
    (team) => team.rank === 1,
  );

  if (!previousLeader || !currentLeader) {
    return null;
  }

  // Follow the same underlying team ID, even if renamed.
  const formerLeader = currentRankings.find(
    (team) => team.id === previousLeader.id,
  );

  if (!formerLeader) return null;

  // Confirm that the earlier approved article actually
  // reported this team at #1.
  const oldRankOne = previousStory.rankings.find(
    (line) => /^1\.\s/.test(line),
  );

  if (
    !oldRankOne?.startsWith(
      `1. ${previousLeader.team} `,
    )
  ) {
    return null;
  }

  const teaser = previousStory.nextWeekTeaser;

  if (
    !teaser ||
    !teaser.toLowerCase().includes(
      previousLeader.team.toLowerCase(),
    ) ||
    !/\b(defend|hold|keep|retain)\b/i.test(teaser) ||
    !/(#1|top ranking|top spot|first place)/i.test(teaser)
  ) {
    return null;
  }

  if (formerLeader.rank === 1) {
    return (
      `The question entering Week ${currentWeek}: ` +
      `could ${formerLeader.team} defend #1? ` +
      `So far, yes. The defending leader still owns ` +
      `the top Power Ranking at ` +
      `${(formerLeader.powerScore * 100).toFixed(1)}/100.`
    );
  }

  return (
    `The question entering Week ${currentWeek}: ` +
    `could ${formerLeader.team} defend #1? ` +
    `Not this time. ${currentLeader.team} takes the top spot, ` +
    `pushing ${formerLeader.team} down to #${formerLeader.rank}. ` +
    `The power struggle has a new chapter.`
  );
}
