import assert from "node:assert/strict";
import test from "node:test";
import type { TeamStats } from "../rankings/allPlay.js";
import { calculateRankingHistory } from "./history.js";

function makeTeam(id: string, name: string, strong: boolean): TeamStats {
  return {
    id,
    name,
    fgm: strong ? 60 : 40,
    fga: 100,
    ftm: strong ? 18 : 12,
    fta: 20,
    threes: strong ? 20 : 5,
    points: strong ? 150 : 90,
    rebounds: strong ? 60 : 35,
    assists: strong ? 40 : 20,
    steals: strong ? 12 : 5,
    blocks: strong ? 10 : 3,
    turnovers: strong ? 8 : 17,
  };
}

const weeks = [
  {
    week: 1,
    teams: [makeTeam("a", "Team A", true), makeTeam("b", "Team B", false)],
  },
  {
    week: 2,
    teams: [
      makeTeam("a", "Renamed Team A", false),
      makeTeam("b", "Team B", true),
    ],
  },
  {
    week: 3,
    teams: [
      makeTeam("a", "Renamed Team A", true),
      makeTeam("b", "Team B", false),
    ],
  },
];

test("tracks ranking movement across weeks", () => {
  const history = calculateRankingHistory(weeks);

  assert.equal(history.length, 3);

  const week1A = history[0]!.rankings.find((team) => team.id === "a")!;

  const week2A = history[1]!.rankings.find((team) => team.id === "a")!;

  const week3A = history[2]!.rankings.find((team) => team.id === "a")!;

  assert.equal(week1A.powerRank, 1);
  assert.equal(week1A.movement, null);

  assert.equal(week2A.powerRank, 2);
  assert.equal(week2A.movement, -1);

  assert.equal(week3A.powerRank, 1);
  assert.equal(week3A.movement, 1);
});

test("preserves history after a team is renamed", () => {
  const history = calculateRankingHistory(weeks);

  const team = history[2]!.rankings.find((team) => team.id === "a")!;

  assert.equal(team.team, "Renamed Team A");
  assert.equal(team.seasonCategoryWins, 18);
  assert.equal(team.seasonCategoryLosses, 9);
  assert.equal(team.seasonCategoryTies, 0);

  assert.ok(Math.abs(team.seasonCategoryWinRate - 2 / 3) < 1e-10);
});

test("sorts weeks chronologically", () => {
  const history = calculateRankingHistory([weeks[2]!, weeks[0]!, weeks[1]!]);

  assert.deepEqual(
    history.map((week) => week.week),
    [1, 2, 3],
  );
});
