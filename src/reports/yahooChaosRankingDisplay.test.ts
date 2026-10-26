import assert from "node:assert/strict";
import test from "node:test";

import {
  formatYahooRankingDisplay,
} from "./yahooChaosRankingDisplay.js";

test("shows preseason ranking for real Week 1", () => {
  assert.equal(
    formatYahooRankingDisplay({
      rank: 1,
      team: "Large Lillard Model 🤖",
      movement: 4,
    }, 1, "real"),
    "1. Large Lillard Model 🤖 (Preseason #5)",
  );
});

test("shows preseason ranking for a major fall", () => {
  assert.equal(
    formatYahooRankingDisplay({
      rank: 12,
      team: "King of the Castle 🏰",
      movement: -11,
    }, 1, "real"),
    "12. King of the Castle 🏰 (Preseason #1)",
  );
});

test("shows last week's ranking from Week 2 onward", () => {
  assert.equal(
    formatYahooRankingDisplay({
      rank: 3,
      team: "Example Team",
      movement: -2,
    }, 2, "real"),
    "3. Example Team (Last week: #1)",
  );
});

test("shows unchanged previous rank", () => {
  assert.equal(
    formatYahooRankingDisplay({
      rank: 5,
      team: "Example Team",
      movement: 0,
    }, 3, "real"),
    "5. Example Team (Last week: #5)",
  );
});

test("synthetic first-week rankings have no preseason claim", () => {
  assert.equal(
    formatYahooRankingDisplay({
      rank: 1,
      team: "Team 1",
      movement: null,
    }, 1, "synthetic"),
    "1. Team 1",
  );
});

test("public ranking hides scores and movement arrows", () => {
  const output = formatYahooRankingDisplay({
    rank: 1,
    team: "Large Lillard Model 🤖",
    movement: 4,
  }, 1, "real");

  assert.equal(output.includes("/100"), false);
  assert.equal(output.includes("⬆️"), false);
  assert.equal(output.includes("⬇️"), false);
  assert.equal(output.includes("➖"), false);
});
