import assert from "node:assert/strict";
import test from "node:test";

import { buildYahooStoryCallback } from "./yahooStoryContinuity.js";

const previous = [
  {
    id: "alpha",
    team: "Team Alpha",
    rank: 1,
    powerScore: 0.60,
  },
  {
    id: "beta",
    team: "Team Beta",
    rank: 2,
    powerScore: 0.58,
  },
];

const approvedStory = {
  week: 2,
  rankings: [
    "1. Team Alpha ⬆️2 — 60.0/100",
    "2. Team Beta ➖ — 58.0/100",
  ],
  nextWeekTeaser: "Can Team Alpha defend the #1 ranking?",
};

test("continues an approved dethroning storyline", () => {
  const current = [
    { ...previous[1]!, rank: 1, powerScore: 0.62 },
    { ...previous[0]!, rank: 2, powerScore: 0.59 },
  ];

  const callback = buildYahooStoryCallback(
    [approvedStory],
    previous,
    current,
    3,
  );

  assert.match(callback!, /Team Beta takes the top spot/);
  assert.match(callback!, /pushing Team Alpha down to #2/);
});

test("recognizes a successful title defense", () => {
  const callback = buildYahooStoryCallback(
    [approvedStory],
    previous,
    previous,
    3,
  );

  assert.match(callback!, /defend #1/);
  assert.match(callback!, /still owns/);
  assert.match(callback!, /60\.0\/100/);
});

test("preserves continuity when a team is renamed", () => {
  const current = [
    { ...previous[0]!, team: "Alpha Reborn" },
    previous[1]!,
  ];

  const callback = buildYahooStoryCallback(
    [approvedStory],
    previous,
    current,
    3,
  );

  assert.match(callback!, /Alpha Reborn/);
  assert.doesNotMatch(callback!, /Team Alpha/);
});

test("does not invent continuity without an approved prior story", () => {
  assert.equal(
    buildYahooStoryCallback([], previous, previous, 3),
    null,
  );

  assert.equal(
    buildYahooStoryCallback(
      [{ ...approvedStory, week: 1 }],
      previous,
      previous,
      3,
    ),
    null,
  );

  assert.equal(
    buildYahooStoryCallback(
      [approvedStory],
      null,
      previous,
      3,
    ),
    null,
  );
});

test("rejects unsupported or inconsistent prior claims", () => {
  assert.equal(
    buildYahooStoryCallback(
      [{
        ...approvedStory,
        nextWeekTeaser: "Can Team Beta make a comeback?",
      }],
      previous,
      previous,
      3,
    ),
    null,
  );

  assert.equal(
    buildYahooStoryCallback(
      [{
        ...approvedStory,
        rankings: ["1. Team Beta — 60.0/100"],
      }],
      previous,
      previous,
      3,
    ),
    null,
  );
});
