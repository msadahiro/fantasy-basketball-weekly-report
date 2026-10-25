import assert from "node:assert/strict";
import test from "node:test";

import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { parseMatchupPairings } from "./matchupPairings.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";

const header =
  "id,name,fg_pct,ft_pct,threes,points,rebounds," +
  "assists,steals,blocks,turnovers";

const rows = Array.from({ length: 12 }, (_, i) => {
  const id = `team-${String(i + 1).padStart(2, "0")}`;

  return [
    id,
    `Team ${i + 1}`,
    (0.4 + i * 0.01).toFixed(3),
    (0.8 - i * 0.01).toFixed(3),
    20 + i,
    400 + i * 10,
    100 + i,
    50 + i,
    10 + i,
    5 + i,
    100 - i,
  ].join(",");
});

const csv = [header, ...rows].join("\n");

const pairings = parseMatchupPairings({
  season: 2026,
  week: 1,
  pairings: [
    ["team-01", "team-12"],
    ["team-02", "team-11"],
    ["team-03", "team-10"],
    ["team-04", "team-09"],
    ["team-05", "team-08"],
    ["team-06", "team-07"],
  ],
});

function calculate(content = csv) {
  const week = parseYahooMatchupCsv(content, 2026, 1);
  return calculateDisplayedAllPlay(week, pairings);
}

test("compares all 12 teams across 99 categories", () => {
  const result = calculate();

  assert.equal(result.rankings.length, 12);
  assert.equal(result.matchups.length, 6);
  assert.equal(result.comparisonsPerTeam, 99);
  assert.equal(result.provisional, true);

  for (const team of result.rankings) {
    assert.equal(
      team.wins + team.losses + team.ties + team.uncertain,
      99,
    );
  }
});

test("ranks stronger teams by provisional All-Play", () => {
  const result = calculate();

  const first = result.rankings[0]!;
  const last = result.rankings[11]!;

  assert.equal(first.id, "team-12");
  assert.equal(first.wins, 88);
  assert.equal(first.losses, 11);
  assert.equal(first.uncertain, 0);

  assert.equal(last.id, "team-01");
  assert.ok(first.midpoint > last.midpoint);

  const matchup = result.matchups[0]!;
  assert.equal(matchup.homeWins, 1);
  assert.equal(matchup.awayWins, 8);
});

test("flags equal rounded FG% as uncertain", () => {
  const modified = csv.replace(
    "team-12,Team 12,0.510",
    "team-12,Team 12,0.400",
  );

  const result = calculate(modified);
  const matchup = result.matchups[0]!;

  assert.equal(matchup.homeWins, 1);
  assert.equal(matchup.awayWins, 7);
  assert.equal(matchup.uncertain, 1);

  const team12 = result.rankings.find(
    (team) => team.id === "team-12",
  )!;

  assert.equal(team12.uncertain, 1);
  assert.ok(team12.minimum < team12.midpoint);
  assert.ok(team12.midpoint < team12.maximum);
});

test("treats equal counting statistics as genuine ties", () => {
  const modified = csv.replace(
    "team-12,Team 12,0.510,0.690,31,",
    "team-12,Team 12,0.510,0.690,20,",
  );

  const matchup = calculate(modified).matchups[0]!;

  assert.equal(matchup.homeWins, 1);
  assert.equal(matchup.awayWins, 7);
  assert.equal(matchup.ties, 1);
  assert.equal(matchup.uncertain, 0);
});

test("rejects mismatched matchup weeks", () => {
  const week = parseYahooMatchupCsv(csv, 2026, 1);

  assert.throws(
    () =>
      calculateDisplayedAllPlay(week, {
        ...pairings,
        week: 2,
      }),
    /Pairings season\/week does not match CSV/,
  );
});

test("calculates a leaderboard without inventing matchups", () => {
  const week = parseYahooMatchupCsv(csv, 2026, 1);
  const result = calculateDisplayedAllPlay(week);

  assert.equal(result.rankings.length, 12);
  assert.equal(result.matchups.length, 0);
  assert.equal(result.comparisonsPerTeam, 99);
});
