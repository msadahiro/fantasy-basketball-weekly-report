import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReadyYahooPeriodManifest,
} from "./yahooPeriodManifest.js";

const identity = {
  leagueId: "league-of-extraordinary-men",
  season: 2026,
  week: 2,
};

const week1 = {
  period: {
    leagueId: identity.leagueId,
    season: 2026,
    week: 1,
    startDate: "2026-10-20",
    endDate: "2026-10-25",
    status: "final",
  },
  evidence: {
    teamsWithFinalStats: 12,
    finalizedMatchups: 6,
  },
};

const week2 = {
  period: {
    ...week1.period,
    week: 2,
    startDate: "2026-10-26",
    endDate: "2026-11-08",
    status: "final",
  },
  evidence: {
    ...week1.evidence,
  },
};

function manifest() {
  return {
    leagueId: identity.leagueId,
    season: identity.season,
    periods: [
      structuredClone(week1),
      structuredClone(week2),
    ],
  };
}

test("accepts finalized regular and extended periods", () => {
  assert.doesNotThrow(() =>
    assertReadyYahooPeriodManifest(
      manifest(),
      identity,
    ),
  );
});

test("rejects an unfinished extended matchup", () => {
  const data = manifest();
  data.periods[1]!.period.status = "in_progress";

  assert.throws(
    () => assertReadyYahooPeriodManifest(data, identity),
    /not ready/,
  );
});

test("rejects incomplete final matchup evidence", () => {
  const data = manifest();
  data.periods[1]!.evidence.finalizedMatchups = 5;

  assert.throws(
    () => assertReadyYahooPeriodManifest(data, identity),
    /not ready/,
  );
});

test("requires verified results from earlier weeks", () => {
  const data = manifest();
  data.periods.shift();

  assert.throws(
    () => assertReadyYahooPeriodManifest(data, identity),
    /requires 2 verified matchup periods/,
  );
});

test("rejects incorrect league identity", () => {
  const data = manifest();
  data.leagueId = "another-league";

  assert.throws(
    () => assertReadyYahooPeriodManifest(data, identity),
    /identity mismatch/,
  );
});

test("rejects overlapping official matchup periods", () => {
  const data = manifest();
  data.periods[1]!.period.startDate = "2026-10-24";

  assert.throws(
    () => assertReadyYahooPeriodManifest(data, identity),
    /Overlapping Yahoo matchup periods/,
  );
});
