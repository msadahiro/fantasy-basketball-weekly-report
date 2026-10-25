import { calculateWeeklyResults } from "../data/weeklyResults.js";

import {
  mapTeamStats,
  type ExtractedTeamStats,
  type StatIdMap,
} from "./statMapping.js";

export interface ExtractedWeek {
  season: number;
  week: number;
  finalized: boolean;
  teams: ExtractedTeamStats[];
}

export function calculateMappedWeeklyResults(
  week: ExtractedWeek,
  mapping: StatIdMap,
) {
  const normalized = {
    season: week.season,
    week: week.week,
    finalized: week.finalized,
    teams: week.teams.map((team) => mapTeamStats(team, mapping)),
  };

  // This validates the normalized week and calculates All-Play.
  return calculateWeeklyResults(normalized);
}
