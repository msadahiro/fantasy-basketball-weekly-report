import { calculateAllPlay } from "./allPlay.js";
import { calculatePowerRankings, type WeeklySnapshot } from "./powerRankings.js";

export interface HistoricalRanking {
  id: string;
  team: string;
  powerRank: number;
  allPlayRank: number;
  previousPowerRank: number | null;
  movement: number | null;
  powerScore: number;
  weeklyCategoryWinRate: number;
  seasonCategoryWinRate: number;
  seasonCategoryWins: number;
  seasonCategoryLosses: number;
  seasonCategoryTies: number;
}

export interface WeeklyRankingHistory {
  week: number;
  rankings: HistoricalRanking[];
}

export function calculateRankingHistory(
  weeks: WeeklySnapshot[],
): WeeklyRankingHistory[] {
  if (weeks.length === 0) {
    throw new Error("At least one week is required.");
  }

  const ordered = [...weeks].sort((a, b) => a.week - b.week);

  let previousRanks = new Map<string, number>();

  const seasonTotals = new Map<
    string,
    { wins: number; losses: number; ties: number }
  >();

  return ordered.map((snapshot, index) => {
    // Only use information available through this week.
    const completedWeeks = ordered.slice(0, index + 1);

    const power = calculatePowerRankings(completedWeeks);
    const allPlay = calculateAllPlay(snapshot.teams);

    const allPlayById = new Map(
      allPlay.map((team, rank) => [team.id, { ...team, rank: rank + 1 }]),
    );

    const rankings: HistoricalRanking[] = power.map((team) => {
      const weekly = allPlayById.get(team.id);

      if (!weekly) {
        throw new Error(`Missing All-Play data for ${team.id}`);
      }

      const totals = seasonTotals.get(team.id) ?? {
        wins: 0,
        losses: 0,
        ties: 0,
      };

      totals.wins += weekly.categoryWins;
      totals.losses += weekly.categoryLosses;
      totals.ties += weekly.categoryTies;

      seasonTotals.set(team.id, totals);

      const previousPowerRank = previousRanks.get(team.id) ?? null;

      const totalCategories = totals.wins + totals.losses + totals.ties;

      return {
        id: team.id,
        team: team.team,
        powerRank: team.rank,
        allPlayRank: weekly.rank,
        previousPowerRank,
        movement:
          previousPowerRank === null ? null : previousPowerRank - team.rank,
        powerScore: team.powerScore,
        weeklyCategoryWinRate: weekly.categoryWinRate,
        seasonCategoryWinRate:
          (totals.wins + totals.ties * 0.5) / totalCategories,
        seasonCategoryWins: totals.wins,
        seasonCategoryLosses: totals.losses,
        seasonCategoryTies: totals.ties,
      };
    });

    previousRanks = new Map(rankings.map((team) => [team.id, team.powerRank]));

    return {
      week: snapshot.week,
      rankings,
    };
  });
}
