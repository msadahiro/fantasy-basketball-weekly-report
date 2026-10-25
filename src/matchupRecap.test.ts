import assert from "node:assert/strict";
import test from "node:test";

import type { TeamStats } from "./allPlay.js";
import { calculateMatchup, recapMatchup } from "./matchupRecap.js";

function team(overrides: Partial<TeamStats>): TeamStats {
  return {
    id: "x",
    name: "X",
    fgm: 40,
    fga: 80,
    ftm: 10,
    fta: 12,
    threes: 12,
    points: 102,
    rebounds: 40,
    assists: 25,
    steals: 7,
    blocks: 4,
    turnovers: 10,
    ...overrides,
  };
}

test("scores all nine categories", () => {
  const result = calculateMatchup(
    team({ id: "a", name: "A" }),
    team({ id: "b", name: "B" }),
  );
  assert.equal(result.categories.length, 9);
});

test("computes FG% and FT% from makes and attempts", () => {
  const result = calculateMatchup(
    team({ id: "a", name: "A", fgm: 50, fga: 80, ftm: 11, fta: 12 }),
    team({ id: "b", name: "B", fgm: 40, fga: 80, ftm: 10, fta: 12 }),
  );
  const fg = result.categories.find((c) => c.key === "fg_pct")!;
  const ft = result.categories.find((c) => c.key === "ft_pct")!;
  assert.equal(fg.homeValue, 50 / 80);
  assert.equal(fg.outcome, "home");
  assert.equal(ft.homeValue, 11 / 12);
  assert.equal(ft.outcome, "home");
});

test("lower turnovers win the turnover category", () => {
  const result = calculateMatchup(
    team({ id: "a", name: "A", turnovers: 8 }),
    team({ id: "b", name: "B", turnovers: 15 }),
  );
  const to = result.categories.find((c) => c.key === "turnovers")!;
  assert.equal(to.outcome, "home");
});

test("equal category values are scored as ties", () => {
  const result = calculateMatchup(
    team({ id: "a", name: "A" }),
    team({ id: "b", name: "B" }),
  );
  // Identical teams => every category tied.
  assert.equal(result.ties, 9);
  assert.equal(result.winner, "tie");
  assert.equal(result.kind, "tie");
});

test("detects a blowout", () => {
  const strong = team({
    id: "a",
    name: "A",
    fgm: 55,
    threes: 20,
    points: 150,
    rebounds: 60,
    assists: 35,
    steals: 12,
    blocks: 9,
    ftm: 11,
    turnovers: 5,
  });
  const weak = team({ id: "b", name: "B", turnovers: 20 });
  const result = calculateMatchup(strong, weak);
  assert.equal(result.winner, "home");
  assert.ok(result.margin >= 5);
  assert.equal(result.kind, "blowout");
  assert.match(recapMatchup(result), /9-0/);
});

test("detects a close matchup", () => {
  // A wins FG%, FT%, 3PM, PTS, REB (5); B wins AST, STL, BLK, TO (4) => 5-4.
  const a = team({
    id: "a",
    name: "A",
    fgm: 45,
    ftm: 11,
    threes: 15,
    points: 116,
    rebounds: 50,
  });
  const b = team({
    id: "b",
    name: "B",
    assists: 40,
    steals: 12,
    blocks: 9,
    turnovers: 5,
  });
  const result = calculateMatchup(a, b);
  assert.equal(result.homeCategoryWins, 5);
  assert.equal(result.awayCategoryWins, 4);
  assert.equal(result.kind, "close");
  assert.match(recapMatchup(result), /edged|photo finish/);
});
