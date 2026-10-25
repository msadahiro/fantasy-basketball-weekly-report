import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePreseasonMovements,
  parsePreseasonRankings,
} from "./preseasonRankings.js";

const names = [
  "King of the Castle",
  "Above the Rim",
  "SPICY CURRY TOWN 🌶️🍛",
  "Durant Jemima",
  "Freaky Z",
  "305 to My City",
  "The 6-7ers",
  "Club Shay Shay",
  "Wembys World",
  "Basketball Sia",
  "Scottie Too Hottie Pt. 2",
  "Not Luka's Team (😭)",
];

const raw = JSON.stringify({
  leagueId: "league-of-extraordinary-men",
  season: 2026,
  type: "editorial-preseason",
  rankings: names.map((name, i) => ({
    rank: i + 1,
    name,
  })),
});

test("validates the 12-team preseason baseline", () => {
  const parsed = parsePreseasonRankings(
    raw,
    "league-of-extraordinary-men",
    2026,
  );

  assert.equal(parsed.rankings.length, 12);
  assert.equal(parsed.rankings[4]!.name, "Freaky Z");
});

test("calculates Week 1 movement against preseason", () => {
  const parsed = parsePreseasonRankings(
    raw,
    "league-of-extraordinary-men",
    2026,
  );

  const teams = names.map((name, i) => ({
    id: `team-${i + 1}`,
    name,
  }));

  const rankings = teams.map((team, i) => ({
    id: team.id,
    rank: i + 1,
  }));

  // Swap preseason #3 and #5 in Week 1.
  rankings[2]!.rank = 5;
  rankings[4]!.rank = 3;

  const movements = calculatePreseasonMovements(
    parsed,
    teams,
    rankings,
  );

  assert.equal(movements.get("team-5"), 2);
  assert.equal(movements.get("team-3"), -2);
  assert.equal(movements.get("team-1"), 0);
});

test("rejects incorrect league identity and team names", () => {
  assert.throws(
    () => parsePreseasonRankings(raw, "another-league", 2026),
    /mismatch/,
  );

  const parsed = parsePreseasonRankings(
    raw,
    "league-of-extraordinary-men",
    2026,
  );

  const teams = names.map((name, i) => ({
    id: `team-${i + 1}`,
    name,
  }));

  const rankings = teams.map((team, i) => ({
    id: team.id,
    rank: i + 1,
  }));

  teams[4]!.name = "Unknown Team";

  assert.throws(
    () => calculatePreseasonMovements(parsed, teams, rankings),
    /Cannot match Yahoo team/,
  );
});

test("preserves preseason movement after verified team renames", () => {
  const data = JSON.parse(raw);

  data.rankings[2].currentName = "WASHED KINGS";
  data.rankings[3].currentName = "SARR pandemic";
  data.rankings[4].currentName = "Large Lillard Model 🤖";
  data.rankings[6].currentName = "Green Light District 🚦";
  data.rankings[8].currentName = "morANT";

  const parsed = parsePreseasonRankings(
    JSON.stringify(data),
    "league-of-extraordinary-men",
    2026,
  );

  const teams = data.rankings.map(
    (entry: { name: string; currentName?: string }, i: number) => ({
      id: `team-${i + 1}`,
      name: entry.currentName ?? entry.name,
    }),
  );

  const rankings = teams.map(
    (team: { id: string }, i: number) => ({
      id: team.id,
      rank: i + 1,
    }),
  );

  // Preseason #3 drops to #8; preseason #8 rises to #3.
  rankings[2]!.rank = 8;
  rankings[7]!.rank = 3;

  const movement = calculatePreseasonMovements(
    parsed,
    teams,
    rankings,
  );

  assert.equal(movement.get("team-3"), -5);
  assert.equal(movement.get("team-8"), 5);
  assert.equal(movement.get("team-5"), 0);
});

test("rejects conflicting current team aliases", () => {
  const data = JSON.parse(raw);

  data.rankings[2].currentName = "WASHED KINGS";
  data.rankings[3].currentName = "WASHED KINGS";

  assert.throws(
    () => parsePreseasonRankings(
      JSON.stringify(data),
      "league-of-extraordinary-men",
      2026,
    ),
    /Duplicate preseason rank or team name/,
  );
});
