import assert from "node:assert/strict";
import test from "node:test";

import { calculateMappedWeeklyResults } from "./weeklyPipeline.js";
import type { StatIdMap } from "./statMapping.js";

const mapping: StatIdMap = {
  fgm: "a",
  fga: "b",
  ftm: "c",
  fta: "d",
  threes: "e",
  points: "f",
  rebounds: "g",
  assists: "h",
  steals: "i",
  blocks: "j",
  turnovers: "k",
};

// Fictional stat IDs and invented basketball statistics.
function sampleWeek() {
  return {
    season: 2026,
    week: 1,
    finalized: true,
    teams: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i + 1}`,
      name: `Demo Team ${i + 1}`,
      stats: [
        { id: "a", value: 40 },
        { id: "b", value: 80 },
        { id: "c", value: 10 },
        { id: "d", value: 12 },
        { id: "e", value: 12 },
        { id: "f", value: 102 },
        { id: "g", value: 40 },
        { id: "h", value: 25 },
        { id: "i", value: 7 },
        { id: "j", value: 4 },
        { id: "k", value: 15 - i },
      ],
    })),
  };
}

test("maps, validates, and ranks a complete week", () => {
  const result = calculateMappedWeeklyResults(sampleWeek(), mapping);

  assert.equal(result.season, 2026);
  assert.equal(result.week, 1);
  assert.equal(result.allPlay.length, 12);
  assert.equal(result.allPlay[0]?.team, "Demo Team 12");
  assert.equal(result.allPlay[0]?.categoryWins, 11);
  assert.equal(result.allPlay[0]?.categoryLosses, 0);
  assert.equal(result.allPlay[0]?.categoryTies, 88);
  assert.equal(result.allPlay[0]?.categoryWinRate, 5 / 9);
});

test("rejects a week with a missing statistic", () => {
  const week = sampleWeek();

  week.teams[0]!.stats = week.teams[0]!.stats.filter((stat) => stat.id !== "g");

  assert.throws(
    () => calculateMappedWeeklyResults(week, mapping),
    /Missing rebounds/,
  );
});
