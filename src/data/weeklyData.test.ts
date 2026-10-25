import assert from "node:assert/strict";
import test from "node:test";
import { parseWeeklyData } from "./weeklyData.js";

function exampleWeek() {
  return {
    season: 2026,
    week: 1,
    finalized: true,
    teams: Array.from({ length: 12 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Demo Team ${i + 1}`,
      fgm: 40,
      fga: 80,
      ftm: 10,
      fta: 12,
      threes: 12,
      points: 102,
      rebounds: 40,
      assists: 25,
      steals: 7,
      blocks: 4,
      turnovers: 15,
    })),
  };
}

test("accepts a valid 12-team week", () => {
  const result = parseWeeklyData(exampleWeek());
  assert.equal(result.teams.length, 12);
  assert.equal(result.week, 1);
});

test("rejects missing teams", () => {
  const data = exampleWeek();
  data.teams.pop();

  assert.throws(() => parseWeeklyData(data));
});

test("rejects duplicate team IDs", () => {
  const data = exampleWeek();
  data.teams[1]!.id = data.teams[0]!.id;

  assert.throws(() => parseWeeklyData(data));
});

test("rejects impossible shooting totals", () => {
  const data = exampleWeek();
  data.teams[0]!.fgm = 100;

  assert.throws(() => parseWeeklyData(data));
});

test("rejects an unfinalized week", () => {
  const data = exampleWeek();
  data.finalized = false;

  assert.throws(() => parseWeeklyData(data));
});

test("preserves zero free throw attempts", () => {
  const data = exampleWeek();

  data.teams[0]!.ftm = 0;
  data.teams[0]!.fta = 0;

  // Recalculate points after removing free throws.
  const team = data.teams[0]!;
  team.points = 2 * team.fgm + team.threes + team.ftm;

  const result = parseWeeklyData(data);

  assert.equal(result.teams[0]!.fta, 0);
  assert.equal(result.teams[0]!.ftm, 0);
});
