import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOfficialStandings,
  parseOfficialMatchups,
  verifyOfficialMatchups,
} from "./officialYahoo.js";

import type { MatchupResult } from "../reports/matchupRecap.js";

const standings = {
  season: 2025,
  phase: "playoff-final",
  recordScope: "regular-season",
  asOf: "2026-03-30",
  teams: Array.from({ length: 12 }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    placement: i + 1,
    wins: 90,
    losses: 80,
    ties: 1,
  })),
};

const matchups = {
  season: 2026,
  week: 1,
  finalized: true,
  matchups: Array.from({ length: 6 }, (_, i) => ({
    homeId: `team-${i * 2 + 1}`,
    awayId: `team-${i * 2 + 2}`,
    homeWins: 5,
    awayWins: 4,
    ties: 0,
  })),
};

test("preserves official standings separately", () => {
  const result = parseOfficialStandings(standings);

  assert.equal(result.teams.length, 12);
  assert.equal(result.teams[0]!.placement, 1);
  assert.equal(result.phase, "playoff-final");
});

test("rejects duplicate official placements", () => {
  const invalid = structuredClone(standings);
  invalid.teams[1]!.placement = 1;

  assert.throws(
    () => parseOfficialStandings(invalid),
    /Duplicate official placement/,
  );
});

test("accepts six finalized official matchups", () => {
  const result = parseOfficialMatchups(matchups);

  assert.equal(result.matchups.length, 6);
  assert.equal(result.finalized, true);
});

test("rejects impossible nine-category scores", () => {
  const invalid = structuredClone(matchups);
  invalid.matchups[0]!.homeWins = 6;

  assert.throws(
    () => parseOfficialMatchups(invalid),
    /must total 9/,
  );
});

test("rejects teams appearing in multiple matchups", () => {
  const invalid = structuredClone(matchups);
  invalid.matchups[1]!.homeId = "team-1";

  assert.throws(
    () => parseOfficialMatchups(invalid),
    /Each team must appear exactly once/,
  );
});

test("checks calculated results against Yahoo", () => {
  const official = parseOfficialMatchups(matchups);

  const calculated = official.matchups.map((matchup) => ({
    homeId: matchup.homeId,
    awayId: matchup.awayId,
    home: matchup.homeId,
    away: matchup.awayId,
    homeCategoryWins: 5,
    awayCategoryWins: 4,
    ties: 0,
    categories: [],
    winner: "home" as const,
    margin: 1,
    kind: "close" as const,
  })) satisfies MatchupResult[];

  assert.doesNotThrow(() =>
    verifyOfficialMatchups(official, calculated),
  );

  calculated[0]!.homeCategoryWins = 4;

  assert.throws(
    () => verifyOfficialMatchups(official, calculated),
    /Yahoo result mismatch/,
  );
});
