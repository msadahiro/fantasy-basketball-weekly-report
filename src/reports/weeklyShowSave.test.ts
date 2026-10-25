import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { WeeklyShow } from "./weeklyShow.js";
import { saveWeeklyShow } from "./weeklyShowSave.js";

function demoShow(): WeeklyShow {
  const whatsapp = [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "🧪 DEMO ONLY — Synthetic statistics",
    "THE WEEKLY CHAOS REPORT",
    "DEMO ONLY — Nothing has been sent to WhatsApp.",
  ].join("\n");

  const analytics = [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "🧪 DEMO ONLY — Synthetic statistics",
    "DETAILED PRIVATE ANALYTICS",
    "DEMO ONLY — Nothing has been sent to WhatsApp.",
  ].join("\n");

  return {
    status: "draft",
    source: "synthetic",
    week: 3,
    matchups: [],
    rankings: [],
    whatsapp,
    analytics,
    wordCount: 400,
  };
}

test("saves both reports under the private reports directory", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-show-"));
  try {
    const saved = await saveWeeklyShow(demoShow(), directory);

    assert.match(saved.whatsappPath, /demo-weekly-show-week-3\.txt$/);
    assert.match(saved.analyticsPath, /demo-weekly-show-week-3\.analytics\.txt$/);

    assert.equal(
      await readFile(saved.whatsappPath, "utf8"),
      demoShow().whatsapp,
    );
    assert.equal(
      await readFile(saved.analyticsPath, "utf8"),
      demoShow().analytics,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not overwrite an existing draft", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-show-"));
  try {
    await saveWeeklyShow(demoShow(), directory);
    await assert.rejects(saveWeeklyShow(demoShow(), directory), {
      code: "EEXIST",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("real reports use the week- prefix", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-show-"));
  try {
    const show = demoShow();
    show.source = "real";
    show.whatsapp = show.whatsapp.replace(
      "🧪 DEMO ONLY — Synthetic statistics",
      "✅ REAL LEAGUE RESULTS — finalized weekly snapshot",
    );
    show.analytics = show.analytics.replace(
      "🧪 DEMO ONLY — Synthetic statistics",
      "✅ REAL LEAGUE RESULTS — finalized weekly snapshot",
    );

    const saved = await saveWeeklyShow(show, directory);
    assert.match(saved.whatsappPath, /week-weekly-show-week-3\.txt$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a draft missing the private marker", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-show-"));
  try {
    const show = demoShow();
    show.whatsapp = "no marker here";
    await assert.rejects(
      saveWeeklyShow(show, directory),
      /Invalid Weekly Show draft/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
