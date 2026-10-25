import assert from "node:assert/strict";
import test from "node:test";

import {
  createYahooCsvTemplate,
  parseYahooMatchupCsv,
} from "./yahooMatchupCsv.js";

const header =
  "id,name,fg_pct,ft_pct,threes,points,rebounds," +
  "assists,steals,blocks,turnovers";

const rows = Array.from({ length: 12 }, (_, index) => {
  const id = `team-${String(index + 1).padStart(2, "0")}`;

  return (
    `${id},"Team, ${index + 1}",` +
    "0.503,0.810,46,424,136,87,36,24,36"
  );
});

const validCsv = [header, ...rows].join("\n") + "\n";

test("creates a blank 12-team Yahoo template", () => {
  const template = createYahooCsvTemplate();
  const lines = template.trimEnd().split("\n");

  assert.equal(lines.length, 13);
  assert.equal(lines[0], header);
  assert.match(lines[1]!, /^team-01,/);
});

test("imports 12 Yahoo teams and rounded percentages", () => {
  const result = parseYahooMatchupCsv(validCsv, 2026, 1);

  assert.equal(result.teams.length, 12);
  assert.equal(result.teams[0]!.name, "Team, 1");
  assert.equal(result.teams[0]!.fg_pct, 0.503);
  assert.equal(result.teams[0]!.ft_pct, 0.81);
  assert.equal(result.teams[0]!.turnovers, 36);

  assert.equal(result.finalized, false);
  assert.equal(result.source, "yahoo-rounded-display");
});

test("rejects missing team statistics", () => {
  const invalid = validCsv.replace(
    ",46,424,",
    ",,424,",
  );

  assert.throws(
    () => parseYahooMatchupCsv(invalid, 2026, 1),
    /Invalid or missing 3PM/,
  );
});

test("rejects duplicate team IDs", () => {
  const invalid = validCsv.replace(
    "team-12,",
    "team-01,",
  );

  assert.throws(
    () => parseYahooMatchupCsv(invalid, 2026, 1),
    /Duplicate Yahoo team IDs/,
  );
});

test("rejects incomplete leagues", () => {
  const invalid = [header, ...rows.slice(0, 11)].join("\n");

  assert.throws(
    () => parseYahooMatchupCsv(invalid, 2026, 1),
    /Expected exactly 12 Yahoo teams/,
  );
});

test("rejects invalid or overly precise percentages", () => {
  assert.throws(
    () => parseYahooMatchupCsv(
      validCsv.replace("0.503", "50.3"),
      2026,
      1,
    ),
    /Invalid FG%/,
  );

  assert.throws(
    () => parseYahooMatchupCsv(
      validCsv.replace("0.503", "0.5039"),
      2026,
      1,
    ),
    /Invalid FG%/,
  );
});
