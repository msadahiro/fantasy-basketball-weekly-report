import assert from "node:assert/strict";
import test from "node:test";

import type { YahooDisplayedWeek } from "./yahooMatchupCsv.js";
import { calculateYahooRankingHistory } from "./yahooPowerRankings.js";

function makeWeek(
  week: number,
  reversed = false,
): YahooDisplayedWeek {
  return {
    season: 2026,
    week,
    finalized: false,
    source: "yahoo-rounded-display",
    teams: Array.from({ length: 12 }, (_, i) => {
      const strength = reversed ? 11 - i : i;

      return {
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        fg_pct: 0.4 + strength * 0.01,
        ft_pct: 0.7 + strength * 0.01,
        threes: 20 + strength,
        points: 300 + strength,
        rebounds: 100 + strength,
        assists: 70 + strength,
        steals: 10 + strength,
        blocks: 5 + strength,
        turnovers: 100 - strength,
      };
    }),
  };
}

test("week one Power Score equals weekly All-Play", () => {
  const history = calculateYahooRankingHistory([
    makeWeek(1),
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0]!.rankings.length, 12);

  const first = history[0]!.rankings[0]!;

  assert.equal(first.id, "team-12");
  assert.equal(first.powerScore, 1);
  assert.equal(first.seasonRate, 1);
  assert.equal(first.recentRate, 1);
  assert.equal(first.movement, null);
  assert.equal(first.seasonWins, 99);
});

test("uses 60 percent season and weighted recent weeks", () => {
  const history = calculateYahooRankingHistory([
    makeWeek(1),
    makeWeek(2),
    makeWeek(3, true),
  ]);

  const latest = history[2]!;
  const team12 = latest.rankings.find(
    (team) => team.id === "team-12",
  )!;

  // Weekly results: 100%, 100%, 0%.
  // Season average: 2/3.
  // Weighted recent: (1*1 + 1*2 + 0*3)/6 = 0.5.
  // Power Score: 0.6*(2/3) + 0.4*0.5 = 0.6.
  assert.ok(
    Math.abs(team12.seasonRate - 2 / 3) < 1e-10,
  );
  assert.ok(
    Math.abs(team12.recentRate - 0.5) < 1e-10,
  );
  assert.ok(
    Math.abs(team12.powerScore - 0.6) < 1e-10,
  );
  assert.equal(team12.latestAllPlayRank, 12);
});

test("tracks ranking movement between weeks", () => {
  const history = calculateYahooRankingHistory([
    makeWeek(1),
    makeWeek(2, true),
  ]);

  const team12 = history[1]!.rankings.find(
    (team) => team.id === "team-12",
  )!;

  assert.equal(team12.previousPowerRank, 1);
  assert.ok(team12.rank > 1);
  assert.ok((team12.movement ?? 0) < 0);
});

test("propagates rounded-percentage uncertainty", () => {
  const firstWeek = makeWeek(1);

  firstWeek.teams[0]!.fg_pct =
    firstWeek.teams[1]!.fg_pct;

  const history = calculateYahooRankingHistory([
    firstWeek,
  ]);

  const team1 = history[0]!.rankings.find(
    (team) => team.id === "team-1",
  )!;

  assert.equal(team1.seasonUncertain, 1);
  assert.ok(team1.minimumPowerScore < team1.powerScore);
  assert.ok(team1.powerScore < team1.maximumPowerScore);
});

test("rejects missing and duplicate weeks", () => {
  assert.throws(
    () => calculateYahooRankingHistory([makeWeek(2)]),
    /Missing or duplicate Yahoo week/,
  );

  assert.throws(
    () => calculateYahooRankingHistory([
      makeWeek(1),
      makeWeek(1),
    ]),
    /Missing or duplicate Yahoo week/,
  );
});

test("preserves team identity across renames", () => {
  const renamed = makeWeek(2);
  renamed.teams[0]!.name = "Renamed Team";

  const history = calculateYahooRankingHistory([
    makeWeek(1),
    renamed,
  ]);

  const team = history[1]!.rankings.find(
    (entry) => entry.id === "team-1",
  )!;

  assert.equal(team.team, "Renamed Team");
  assert.notEqual(team.previousPowerRank, null);
});

test("rejects changed team IDs and seasons", () => {
  const changedId = makeWeek(2);
  changedId.teams[0]!.id = "replacement";

  assert.throws(
    () => calculateYahooRankingHistory([
      makeWeek(1),
      changedId,
    ]),
    /team IDs changed/,
  );

  const changedSeason = makeWeek(2);
  changedSeason.season = 2027;

  assert.throws(
    () => calculateYahooRankingHistory([
      makeWeek(1),
      changedSeason,
    ]),
    /season changed/,
  );
});
