import { loadWeeklyData } from "./weeklyData.js";
import { calculateWeeklyResults } from "./weeklyResults.js";

/**
 * Import a manually entered weekly statistics file.
 *
 * The file must follow our existing WeeklyData schema.
 * No network requests or publishing occur.
 */
export async function importManualWeek(filepath: string) {
  const week = await loadWeeklyData(filepath);

  // Reuse the scoring engine's own safety checks.
  return calculateWeeklyResults(week);
}
