import assert from "node:assert/strict";
import test from "node:test";
import { calculateAllPlay, type TeamStats } from "./allPlay.js";

const teams: TeamStats[] = [
  {
    id: "a",
    name: "Test Team A",
    fgm: 40,
    fga: 80,
    ftm: 15,
    fta: 20,
    threes: 12,
    points: 110,
    rebounds: 44,
    assists: 26,
    steals: 7,
    blocks: 5,
    turnovers: 12,
  },
  {
    id: "b",
    name: "Test Team B",
    fgm: 38,
    fga: 82,
    ftm: 18,
    fta: 20,
    threes: 15,
    points: 105,
    rebounds: 41,
    assists: 30,
    steals: 6,
    blocks: 3,
    turnovers: 17,
  },
];

test("calculates nine-category all-play results", () => {
  const results = calculateAllPlay(teams);

  assert.equal(results[0]?.team, "Test Team A");
  assert.equal(results[0]?.wins, 1);
  assert.equal(results[0]?.categoryWins, 6);
  assert.equal(results[0]?.allPlayWinRate, 1);

  assert.equal(results[1]?.losses, 1);
  assert.equal(results[1]?.categoryWins, 3);
  assert.equal(results[0]?.categoryWins, 6);
  assert.equal(results[0]?.categoryLosses, 3);
  assert.equal(results[0]?.categoryTies, 0);
  assert.equal(results[0]?.categoryWinRate, 6 / 9);

  assert.equal(results[1]?.categoryWins, 3);
  assert.equal(results[1]?.categoryLosses, 6);
  assert.equal(results[1]?.categoryWinRate, 3 / 9);
});
