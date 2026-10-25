import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createProvisionalMatchupReport,
  saveProvisionalMatchupReport,
} from "./matchupReport.js";

import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
} from "./draftApproval.js";

const csv = [
  "team,fg_pct,ft_pct,threes,points,rebounds,assists,steals,blocks,turnovers",
  "Large Lillard Model 🤖,0.503,0.810,46,424,136,87,36,24,36",
  "Opponent,0.423,0.787,38,485,169,120,24,23,82",
].join("\n");

test("calculates the provisional 6-3 matchup", () => {
  const report = createProvisionalMatchupReport(csv, 1);

  assert.match(report, /6 category leads/);
  assert.match(report, /3 category leads/);
  assert.match(report, /66\.7%/);
  assert.match(report, /33\.3%/);
  assert.match(report, /PROVISIONAL MATCHUP — NOT FINAL/);
  assert.match(report, /NOT OFFICIAL LEAGUE-WIDE POWER RANKINGS/);
});

test("supports all three sportswriter styles", () => {
  const professional = createProvisionalMatchupReport(csv, 1, "professional");

  const playful = createProvisionalMatchupReport(csv, 1, "playful");

  const roast = createProvisionalMatchupReport(csv, 1, "roast");

  assert.notEqual(professional, playful);
  assert.notEqual(playful, roast);
});

test("rejects missing matchup statistics", () => {
  const invalid = csv.replace(",46,424,", ",,424,");

  assert.throws(
    () => createProvisionalMatchupReport(invalid, 1),
    /Invalid 3PM/,
  );
});

test("saves without overwriting an existing draft", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "matchup-report-"));

  try {
    const report = createProvisionalMatchupReport(csv, 1);

    await saveProvisionalMatchupReport(report, 1, directory);

    await assert.rejects(saveProvisionalMatchupReport(report, 1, directory), {
      code: "EEXIST",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("approval becomes stale after editing a provisional draft", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "matchup-approval-"));

  try {
    const filepath = path.join(directory, "matchup.txt");
    const report = createProvisionalMatchupReport(csv, 1);

    await writeFile(filepath, report);
    await approvePrivateDraft(filepath, hashDraft(report));

    assert.equal(await getDraftApprovalStatus(filepath), "approved");

    await writeFile(filepath, report + "\nEdited.");

    assert.equal(await getDraftApprovalStatus(filepath), "modified");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
