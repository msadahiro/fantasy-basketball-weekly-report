import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeekOnePreseasonRecap,
} from "./preseasonNarrative.js";

const teams = Array.from({ length: 12 }, (_, i) => ({
  id: `team-${i + 1}`,
  team: `Team ${i + 1}`,
  rank: i + 1,
}));

test("describes a rise from the preseason baseline", () => {
  const current = teams.map((team) => ({ ...team }));

  current[0]!.rank = 5;
  current[4]!.rank = 1;

  const movement = new Map(
    current.map((team) => [
      team.id,
      (Number(team.id.split("-")[1]) - team.rank),
    ]),
  );

  const recap = buildWeekOnePreseasonRecap(
    current,
    movement,
  );

  assert.match(recap, /Team 5 climbed 4 spots/);
  assert.match(recap, /preseason #5 to #1/);
  assert.match(recap, /Team 1 has fallen to #5/);
});

test("handles unchanged preseason rankings", () => {
  const movement = new Map(
    teams.map((team) => [team.id, 0]),
  );

  const recap = buildWeekOnePreseasonRecap(
    teams,
    movement,
  );

  assert.match(recap, /no movement after Week 1/);
});

test("rejects incomplete preseason movement", () => {
  assert.throws(
    () => buildWeekOnePreseasonRecap(
      teams,
      new Map([["team-1", 0]]),
    ),
    /Expected complete 12-team/,
  );
});
