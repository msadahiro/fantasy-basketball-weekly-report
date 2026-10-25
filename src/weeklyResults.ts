import { calculateAllPlay } from "./allPlay.js";
import { parseWeeklyData } from "./weeklyData.js";

export function calculateWeeklyResults(input: unknown) {
  const week = parseWeeklyData(input);

  // Zero-attempt percentage scoring is not yet verified.
  const incomplete = week.teams.find(
    (team) => team.fga === 0 || team.fta === 0,
  );

  if (incomplete) {
    throw new Error(
      `Cannot rank ${incomplete.name}: zero shooting attempts ` +
        "require confirmed Yahoo scoring rules.",
    );
  }

  return {
    season: week.season,
    week: week.week,
    allPlay: calculateAllPlay(week.teams),
  };
}
