import { readFileSync } from "node:fs";
import { calculateAllPlay, type TeamStats } from "./allPlay";

export interface WeeklyData {
  season: number;
  week: number;
  finalized: boolean;
  teams: TeamStats[];
}

export function loadWeeklyData(path: string): WeeklyData {
  const data = JSON.parse(readFileSync(path, "utf8")) as WeeklyData;

  if (!Number.isInteger(data.season)) {
    throw new Error("Invalid season");
  }

  if (!Number.isInteger(data.week) || data.week < 1) {
    throw new Error("Invalid week");
  }

  if (data.finalized !== true) {
    throw new Error("Weekly results are not finalized");
  }

  if (!Array.isArray(data.teams) || data.teams.length !== 12) {
    throw new Error("Expected exactly 12 teams");
  }

  // Validates team IDs and category statistics.
  calculateAllPlay(data.teams);

  return data;
}
