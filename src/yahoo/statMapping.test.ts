import assert from "node:assert/strict";
import test from "node:test";

import {
  mapTeamStats,
  type StatIdMap,
  type ExtractedTeamStats,
} from "./statMapping.js";

// Entirely fictional stat IDs for testing.
const mapping: StatIdMap = {
  fgm: "a",
  fga: "b",
  ftm: "c",
  fta: "d",
  threes: "e",
  points: "f",
  rebounds: "g",
  assists: "h",
  steals: "i",
  blocks: "j",
  turnovers: "k",
};

function sampleTeam(): ExtractedTeamStats {
  return {
    id: "demo-1",
    name: "Demo Team",
    stats: [
      { id: "a", value: "40" },
      { id: "b", value: "80" },
      { id: "c", value: "10" },
      { id: "d", value: "12" },
      { id: "e", value: "12" },
      { id: "f", value: "102" },
      { id: "g", value: "40" },
      { id: "h", value: "25" },
      { id: "i", value: "7" },
      { id: "j", value: "4" },
      { id: "k", value: "15" },
    ],
  };
}

test("maps stat IDs into our TeamStats format", () => {
  const result = mapTeamStats(sampleTeam(), mapping);

  assert.equal(result.id, "demo-1");
  assert.equal(result.fgm, 40);
  assert.equal(result.fga, 80);
  assert.equal(result.threes, 12);
  assert.equal(result.points, 102);
});

test("rejects missing required statistics", () => {
  const team = sampleTeam();
  team.stats = team.stats.filter((stat) => stat.id !== "a");

  assert.throws(() => mapTeamStats(team, mapping), /Missing fgm/);
});

test("rejects duplicate incoming stat IDs", () => {
  const team = sampleTeam();
  team.stats.push({ id: "a", value: "40" });

  assert.throws(() => mapTeamStats(team, mapping), /Duplicate incoming stat/);
});

test("rejects duplicate mapping IDs", () => {
  const invalidMapping = { ...mapping, fga: "a" };

  assert.throws(
    () => mapTeamStats(sampleTeam(), invalidMapping),
    /Invalid or duplicate stat mappings/,
  );
});
