import assert from "node:assert/strict";
import test from "node:test";

import { detectStorylines } from "./storylines.js";
import type { WeeklyRankingHistory } from "../data/history.js";

function sampleHistory(): WeeklyRankingHistory {
  const previousRanks = [3, 4, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12];

  return {
    week: 3,
    rankings: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i + 1}`,
      team: `Demo Team ${i + 1}`,
      powerRank: i + 1,
      allPlayRank: i + 1,
      previousPowerRank: previousRanks[i]!,
      movement: previousRanks[i]! - (i + 1),
      powerScore: (12 - i) / 13,
      weeklyCategoryWinRate: (12 - i) / 13,
      seasonCategoryWinRate: 0.5,
      seasonCategoryWins: 55,
      seasonCategoryLosses: 44,
      seasonCategoryTies: 0,
    })),
  };
}

test("detects tied biggest risers and fallers", () => {
  const storylines = detectStorylines(sampleHistory());

  const risers = storylines
    .filter((story) => story.kind === "biggest_riser")
    .map((story) => story.team);

  const fallers = storylines
    .filter((story) => story.kind === "biggest_fall")
    .map((story) => story.team);

  assert.deepEqual(risers, ["Demo Team 1", "Demo Team 2"]);

  assert.deepEqual(fallers, ["Demo Team 3", "Demo Team 4"]);
});

test("detects weekly surprises and disappointments", () => {
  const history = sampleHistory();

  // Swap weekly ranks for Team 2 and Team 9.
  // Their Power Rankings remain unchanged.
  history.rankings[1]!.allPlayRank = 9;
  history.rankings[8]!.allPlayRank = 2;

  const storylines = detectStorylines(history);

  const overperformers = storylines.filter(
    (story) => story.kind === "weekly_overperformer",
  );

  const underperformers = storylines.filter(
    (story) => story.kind === "weekly_underperformer",
  );

  assert.deepEqual(
    overperformers.map((story) => story.team),
    ["Demo Team 9"],
  );

  assert.deepEqual(
    underperformers.map((story) => story.team),
    ["Demo Team 2"],
  );
});

test("does not invent storylines without meaningful changes", () => {
  const history = sampleHistory();

  for (const team of history.rankings) {
    team.movement = null;
    team.allPlayRank = team.powerRank;
  }

  const storylines = detectStorylines(history);

  assert.deepEqual(storylines, []);
});
