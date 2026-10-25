import assert from "node:assert/strict";
import test from "node:test";

import { formatStoryline } from "./sportswriter.js";
import type { Storyline } from "./storylines.js";

const sample: Storyline = {
  kind: "biggest_riser",
  week: 3,
  teamId: "demo-7",
  team: "Demo Team 7",
  powerRank: 4,
  allPlayRank: 2,
  movement: 7,
  weeklyCategoryWinRate: 0.687,
};

test("preserves factual results across all styles", () => {
  for (const style of ["professional", "playful", "roast"] as const) {
    const text = formatStoryline(sample, style);

    assert.match(text, /Demo Team 7/);
    assert.match(text, /Up 7 spots/);
    assert.match(text, /#4/);
    assert.match(text, /#2/);
  }
});

test("produces different commentary for each style", () => {
  const professional = formatStoryline(sample, "professional");

  const playful = formatStoryline(sample, "playful");
  const roast = formatStoryline(sample, "roast");

  assert.notEqual(professional, playful);
  assert.notEqual(playful, roast);
  assert.notEqual(professional, roast);

  assert.equal(formatStoryline(sample), playful);
});

test("reports underperformance accurately", () => {
  const story: Storyline = {
    ...sample,
    kind: "weekly_underperformer",
    powerRank: 2,
    allPlayRank: 6,
    movement: -1,
  };

  const text = formatStoryline(story, "roast");

  assert.match(text, /Power ranked #2/);
  assert.match(text, /finished #6/);
  assert.match(text, /4 places below/);
});
