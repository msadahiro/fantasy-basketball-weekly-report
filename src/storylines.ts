import type { HistoricalRanking, WeeklyRankingHistory } from "./history.js";

export type StorylineKind =
  | "biggest_riser"
  | "biggest_fall"
  | "weekly_overperformer"
  | "weekly_underperformer";

export interface Storyline {
  kind: StorylineKind;
  week: number;
  teamId: string;
  team: string;
  powerRank: number;
  allPlayRank: number;
  movement: number | null;
  weeklyCategoryWinRate: number;
}

export function detectStorylines(snapshot: WeeklyRankingHistory): Storyline[] {
  const rankings = [...snapshot.rankings].sort(
    (a, b) => a.powerRank - b.powerRank,
  );

  const movements = rankings
    .map((team) => team.movement)
    .filter((value): value is number => value !== null);

  const maxRise = Math.max(0, ...movements);
  const maxFall = Math.min(0, ...movements);

  const storylines: Storyline[] = [];

  function add(kind: StorylineKind, team: HistoricalRanking) {
    storylines.push({
      kind,
      week: snapshot.week,
      teamId: team.id,
      team: team.team,
      powerRank: team.powerRank,
      allPlayRank: team.allPlayRank,
      movement: team.movement,
      weeklyCategoryWinRate: team.weeklyCategoryWinRate,
    });
  }

  // Largest positive
  // Biggest risers and fallers, including ties.
  for (const team of rankings) {
    if (maxRise > 0 && team.movement === maxRise) {
      add("biggest_riser", team);
    }

    if (maxFall < 0 && team.movement === maxFall) {
      add("biggest_fall", team);
    }
  }

  // Compare the team's overall Power Ranking with
  // its performance in the latest week.
  //
  // A difference of at least 3 positions is considered
  // significant enough to become a storyline.
  const surpriseThreshold = 3;

  for (const team of rankings) {
    const difference = team.powerRank - team.allPlayRank;

    if (difference >= surpriseThreshold) {
      add("weekly_overperformer", team);
    }

    if (difference <= -surpriseThreshold) {
      add("weekly_underperformer", team);
    }
  }

  return storylines;
}
