import assert from "node:assert/strict";
import test from "node:test";
import { calculateAllPlay, type TeamStats } from "./allPlay";
import { calculatePowerRankings } from "./powerRankings";

function team(id: string, name: string, strong: boolean): TeamStats {
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
    teams: [team("a", "Team A", true), team("b", "Team B", false)],
  },
  {
    week: 2,
    teams: [team("a", "Team A", true), team("b", "Team B", false)],
  },
  {
    week: 3,
    teams: [team("a", "Team A", false), team("b", "Team B", true)],
  },
];

test("power rankings differ from weekly All-Play", () => {
  const latestAllPlay = calculateAllPlay(weeks[2]!.teams);
  const powerRankings = calculatePowerRankings(weeks);

  assert.equal(latestAllPlay[0]?.team, "Team B");
  assert.equal(powerRankings[0]?.team, "Team A");
  assert.equal(powerRankings[0]?.latestAllPlayRank, 2);
  assert.ok(Math.abs(powerRankings[0]!.powerScore - 0.6) < 1e-10);
});

test("rejects duplicate weeks", () => {
  assert.throws(() => calculatePowerRankings([weeks[0]!, weeks[0]!]));
});
