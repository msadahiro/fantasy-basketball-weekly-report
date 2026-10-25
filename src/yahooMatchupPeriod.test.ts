import assert from "node:assert/strict";
import test from "node:test";

import {
  assertYahooMatchupReadyForReport,
  isYahooMatchupReadyForReport,
  validateYahooMatchupPeriod,
  validateYahooMatchupSchedule,
  yahooMatchupDays,
  yahooMatchupReportId,
  type YahooMatchupPeriod,
} from "./yahooMatchupPeriod.js";

const regular: YahooMatchupPeriod = {
  leagueId: "league-of-extraordinary-men",
  season: 2026,
  week: 6,
  startDate: "2026-11-23",
  endDate: "2026-11-29",
  status: "final",
};

const extended: YahooMatchupPeriod = {
  ...regular,
  week: 7,
  startDate: "2026-11-30",
  endDate: "2026-12-13",
  status: "in_progress",
};

const complete = {
  teamsWithFinalStats: 12,
  finalizedMatchups: 6,
};

test("recognizes a seven-day matchup", () => {
  assert.equal(yahooMatchupDays(regular), 7);
});

test("recognizes a fourteen-day matchup as one Yahoo week", () => {
  assert.equal(yahooMatchupDays(extended), 14);
  assert.equal(
    yahooMatchupReportId(extended),
    "2026-week-7",
  );
});

test("does not generate halfway through an extended matchup", () => {
  assert.equal(
    isYahooMatchupReadyForReport(extended, complete),
    false,
  );
});

test("generates one report after the extended matchup is final", () => {
  const finalized = {
    ...extended,
    status: "final" as const,
  };

  assert.equal(
    isYahooMatchupReadyForReport(finalized, complete),
    true,
  );

  assert.equal(
    yahooMatchupReportId(finalized),
    yahooMatchupReportId(extended),
  );
});

test("requires all twelve team totals and six final matchups", () => {
  const partial = {
    teamsWithFinalStats: 11,
    finalizedMatchups: 5,
  };

  assert.throws(
    () => assertYahooMatchupReadyForReport(regular, partial),
    /not ready/,
  );
});

test("rejects duplicate official Yahoo weeks", () => {
  assert.throws(
    () => validateYahooMatchupSchedule([
      extended,
      { ...extended, status: "final" },
    ]),
    /Duplicate official Yahoo Week/,
  );
});

test("accepts consecutive regular and extended matchups", () => {
  assert.doesNotThrow(() =>
    validateYahooMatchupSchedule([regular, extended])
  );
});

test("rejects invalid and overlapping matchup dates", () => {
  assert.throws(
    () => validateYahooMatchupPeriod({
      ...regular,
      startDate: "2026-02-30",
    }),
    /Invalid Yahoo matchup date/,
  );

  assert.throws(
    () => validateYahooMatchupSchedule([
      regular,
      {
        ...extended,
        startDate: "2026-11-28",
      },
    ]),
    /Overlapping Yahoo matchup periods/,
  );
});

test("keeps the same fantasy season across New Year's Day", () => {
  const crossover: YahooMatchupPeriod = {
    ...regular,
    week: 12,
    startDate: "2026-12-28",
    endDate: "2027-01-10",
  };

  assert.equal(yahooMatchupDays(crossover), 14);
  assert.equal(
    yahooMatchupReportId(crossover),
    "2026-week-12",
  );
});

test("allows Week 1 to restart in a new fantasy season", () => {
  const firstSeason: YahooMatchupPeriod = {
    ...regular,
    week: 1,
    startDate: "2026-10-20",
    endDate: "2026-10-25",
  };

  const nextSeason: YahooMatchupPeriod = {
    ...regular,
    season: 2027,
    week: 1,
    startDate: "2027-10-19",
    endDate: "2027-10-24",
  };

  assert.doesNotThrow(() =>
    validateYahooMatchupSchedule([firstSeason, nextSeason])
  );

  assert.equal(
    yahooMatchupReportId(firstSeason),
    "2026-week-1",
  );

  assert.equal(
    yahooMatchupReportId(nextSeason),
    "2027-week-1",
  );
});
