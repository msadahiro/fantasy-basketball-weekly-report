import assert from "node:assert/strict";
import test from "node:test";

import {
  assignEditorialStyles,
  EDITORIAL_STYLES,
} from "./editorialStyles.js";

const teamIds = Array.from(
  { length: 12 },
  (_, i) => `team-${i + 1}`,
);

const base = {
  leagueId: "league-test",
  season: 2026,
  week: 1,
  teamIds,
};

test("assignments are deterministic", () => {
  assert.deepEqual(
    assignEditorialStyles(base),
    assignEditorialStyles(base),
  );
});

test("team input ordering does not change assignments", () => {
  assert.deepEqual(
    assignEditorialStyles(base),
    assignEditorialStyles({
      ...base,
      teamIds: [...teamIds].reverse(),
    }),
  );
});

test("each of six styles is assigned to two teams", () => {
  const assignments = Object.values(
    assignEditorialStyles(base),
  );

  for (const style of EDITORIAL_STYLES) {
    assert.equal(
      assignments.filter((value) => value === style).length,
      2,
    );
  }
});

test("every team changes styles each consecutive week", () => {
  const first = assignEditorialStyles(base);
  const second = assignEditorialStyles({
    ...base,
    week: 2,
  });

  for (const id of teamIds) {
    assert.notEqual(first[id], second[id]);
  }
});

test("every team experiences all six styles in six weeks", () => {
  for (const id of teamIds) {
    const styles = new Set(
      Array.from({ length: 6 }, (_, index) =>
        assignEditorialStyles({
          ...base,
          week: index + 1,
        })[id]
      ),
    );

    assert.equal(styles.size, 6);
  }
});

test("rejects invalid inputs without modifying team IDs", () => {
  const original = [...teamIds];

  assert.throws(
    () => assignEditorialStyles({
      ...base,
      week: 0,
    }),
    /Invalid matchup week/,
  );

  assert.throws(
    () => assignEditorialStyles({
      ...base,
      teamIds: [...teamIds.slice(0, 11), teamIds[0]!],
    }),
    /Expected 12 unique team IDs/,
  );

  assert.deepEqual(teamIds, original);
});
