import assert from "node:assert/strict";
import test from "node:test";
import { calculateWeeklyResults } from "./weeklyResults.js";

function sampleWeek() {
  return {
    season: 2026,
    week: 1,
    finalized: true,
    teams: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i + 1}`,
      name: `Demo Team ${i + 1}`,
      fgm: 40 + i,
      fga: 80,
      ftm: 10,
      fta: 12,
      threes: 12,
      points: 102 + 2 * i,
      rebounds: 40,
      assists: 25,
      steals: 7,
      blocks: 4,
      turnovers: 15,
    })),
  };
}

test("converts validated weekly data into All-Play rankings", () => {
  const result = calculateWeeklyResults(sampleWeek());

  assert.equal(result.week, 1);
  assert.equal(result.allPlay.length, 12);
  assert.equal(result.allPlay[0]?.team, "Demo Team 12");
});

test("does not silently score zero shooting attempts", () => {
  const data = sampleWeek();

  data.teams[0]!.fta = 0;
  data.teams[0]!.ftm = 0;

  // Keep total points consistent.
  const team = data.teams[0]!;
  team.points = 2 * team.fgm + team.threes + team.ftm;

  assert.throws(() => calculateWeeklyResults(data), /zero shooting attempts/);
});
