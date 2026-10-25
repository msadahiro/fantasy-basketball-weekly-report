import assert from "node:assert/strict";
import test from "node:test";

import { createCsvTemplate, convertManualCsv } from "./manualCsv.js";

function validCsv(): string {
  const header = createCsvTemplate().split("\n")[0]!;

  const rows = Array.from({ length: 12 }, (_, i) =>
    [
      `team-${String(i + 1).padStart(2, "0")}`,
      i === 0 ? '"Swish, Please"' : `Team ${i + 1}`,
      40,
      80,
      10,
      12,
      12,
      102,
      40,
      25,
      7,
      4,
      15 - i,
    ].join(","),
  );

  return [header, ...rows].join("\n");
}

test("creates a blank 12-team CSV template", () => {
  const lines = createCsvTemplate().trimEnd().split("\n");

  assert.equal(lines.length, 13);
  assert.match(lines[0]!, /^id,name,fgm,fga/);
  assert.match(lines[1]!, /^team-01,/);
});

test("converts valid CSV including quoted team names", () => {
  const data = convertManualCsv(validCsv(), 2026, 1);

  assert.equal(data.teams.length, 12);
  assert.equal(data.teams[0]!.name, "Swish, Please");
  assert.equal(data.teams[0]!.points, 102);
});

test("rejects blank statistics", () => {
  const csv = validCsv().replace("40,80,10,12,12,102", "40,80,10,12,12,");

  assert.throws(
    () => convertManualCsv(csv, 2026, 1),
    /Invalid or missing points/,
  );
});

test("rejects inconsistent points", () => {
  const csv = validCsv().replace("40,80,10,12,12,102", "40,80,10,12,12,999");

  assert.throws(
    () => convertManualCsv(csv, 2026, 1),
    /Points inconsistent with shooting totals/,
  );
});
