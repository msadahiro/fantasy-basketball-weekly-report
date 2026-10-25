import { calculateAllPlay, type TeamStats } from "./allPlay.js";

export interface WeeklySnapshot {
  week: number;
  teams: TeamStats[];
}

export function calculatePowerRankings(weeks: WeeklySnapshot[]) {
  if (weeks.length === 0) {
    throw new Error("At least one week is required.");
  }

  const ordered = [...weeks].sort((a, b) => a.week - b.week);
  let expectedIds: Set<string> | undefined;
  let previousWeek = 0;

  const history = ordered.map(({ week, teams }) => {
    if (!Number.isInteger(week) || week <= previousWeek) {
      throw new Error(`Invalid or duplicate week: ${week}`);
    }
    previousWeek = week;

    const results = calculateAllPlay(teams);
    const ids = new Set(results.map((team) => team.id));

    const previousIds = expectedIds;

    if (
      previousIds &&
      (ids.size !== previousIds.size ||
        [...ids].some((id) => !previousIds.has(id)))
    ) {
      throw new Error(`Team IDs changed in week ${week}`);
    }

    expectedIds = ids;
    return { week, results };
  });

  const latest = history[history.length - 1]!.results;

  const rankings = latest.map((team, index) => {
    const rates = history.map(
      ({ results }) =>
        results.find((result) => result.id === team.id)!.categoryWinRate,
    );

    const seasonRate =
      rates.reduce((sum, rate) => sum + rate, 0) / rates.length;

    // Most recent three weeks, with greater weight on newer weeks.
    const recent = rates.slice(-3);
    const weightTotal = recent.reduce((sum, _, i) => sum + i + 1, 0);

    const recentRate =
      recent.reduce((sum, rate, i) => sum + rate * (i + 1), 0) / weightTotal;

    const powerScore = seasonRate * 0.6 + recentRate * 0.4;

    return {
      id: team.id,
      team: team.team,
      latestAllPlayRank: index + 1,
      seasonRate,
      recentRate,
      powerScore,
    };
  });

  return rankings
    .sort(
      (a, b) =>
        b.powerScore - a.powerScore ||
        b.seasonRate - a.seasonRate ||
        a.team.localeCompare(b.team),
    )
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}
