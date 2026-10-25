import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPairingsCoverTeams,
  parseMatchupPairings,
} from "./matchupPairings.js";

function validPairings() {
  return {
    season: 2026,
    week: 3,
    pairings: [
      ["t1", "t12"],
      ["t2", "t11"],
      ["t3", "t10"],
      ["t4", "t9"],
      ["t5", "t8"],
      ["t6", "t7"],
    ],
  };
}

const teamIds = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);

test("accepts exactly six valid pairings covering all twelve teams", () => {
  const pairings = parseMatchupPairings(validPairings());
  assert.equal(pairings.pairings.length, 6);
  assertPairingsCoverTeams(pairings, teamIds);
});

test("rejects fewer than six pairings", () => {
  const data = validPairings();
  data.pairings.pop();
  assert.throws(() => parseMatchupPairings(data));
});

test("rejects more than six pairings", () => {
  const data = validPairings();
  data.pairings.push(["t1", "t2"]);
  assert.throws(() => parseMatchupPairings(data));
});

test("rejects a team paired against itself", () => {
  const data = validPairings();
  data.pairings[0] = ["t1", "t1"];
  assert.throws(() => parseMatchupPairings(data), /cannot play itself/);
});

test("rejects a duplicated team id across pairings", () => {
  const data = validPairings();
  data.pairings[5] = ["t6", "t1"];
  assert.throws(() => parseMatchupPairings(data), /more than one pairing/);
});

test("rejects pairings that reference an unknown team", () => {
  const data = validPairings();
  data.pairings[0] = ["t1", "ghost"];
  const pairings = parseMatchupPairings(data);
  assert.throws(
    () => assertPairingsCoverTeams(pairings, teamIds),
    /unknown team ID/,
  );
});

test("reports a missing league team when coverage is incomplete", () => {
  // Pairings covering only 11 distinct teams cannot be produced by the parser
  // (it requires six pairings), so exercise the coverage check directly.
  const pairings = {
    season: 2026,
    week: 3,
    pairings: [
      ["t1", "t12"],
      ["t2", "t11"],
      ["t3", "t10"],
      ["t4", "t9"],
      ["t5", "t8"],
    ],
  } as unknown as ReturnType<typeof parseMatchupPairings>;

  assert.throws(
    () => assertPairingsCoverTeams(pairings, teamIds),
    /missing team ID\(s\): t6, t7/,
  );
});

test("rejects a roster that is not twelve unique teams", () => {
  const pairings = parseMatchupPairings(validPairings());
  assert.throws(
    () => assertPairingsCoverTeams(pairings, teamIds.slice(0, 11)),
    /12 unique team IDs/,
  );
});
