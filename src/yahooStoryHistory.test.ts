import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  approvePrivateDraft,
  hashDraft,
  rejectPrivateDraft,
} from "./draftApproval.js";
import { saveYahooChaosDraft } from "./yahooChaosSave.js";
import { loadApprovedYahooStoryHistory } from "./yahooStoryHistory.js";

function report(
  week: number,
  source: "synthetic" | "real",
): string {
  const label = source === "synthetic"
    ? "DEMO ONLY — Synthetic statistics"
    : "MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED";

  const rankings = Array.from(
    { length: 12 },
    (_, i) => `${i + 1}. Team ${i + 1} — 50/100`,
  );

  return [
    "PRIVATE DRAFT — NOT APPROVED",
    label,
    "THE WEEKLY CHAOS REPORT",
    `*LEAGUE OF EXTRAORDINARY MEN — WEEK ${week}*`,
    `_WEEK ${week} HEADLINE_`,
    "",
    "📊 *PROVISIONAL POWER RANKINGS*",
    ...rankings,
    "",
    "🏆 *THE CHAOS AWARDS*",
    "Steamroller: Team 1.",
    "",
    "📰 *THE BIG PICTURE*",
    "Team 1 is building momentum.",
    "",
    "🔮 *NEXT WEEK'S DRAMA*",
    "Can Team 1 defend the top ranking?",
    "",
    "detail ".repeat(300),
  ].join("\n");
}

async function approve(
  content: string,
  week: number,
  source: "synthetic" | "real",
  directory: string,
): Promise<string> {
  const filepath = await saveYahooChaosDraft(
    content, 2026, week, source, directory,
  );
  await approvePrivateDraft(filepath, hashDraft(content));
  return filepath;
}

test("loads only approved earlier weeks in order", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "story-"));

  try {
    await approve(report(2, "synthetic"), 2, "synthetic", directory);
    await approve(report(1, "synthetic"), 1, "synthetic", directory);

    await saveYahooChaosDraft(
      report(3, "synthetic"), 2026, 3, "synthetic", directory,
    );

    const history = await loadApprovedYahooStoryHistory({
      season: 2026,
      beforeWeek: 3,
      source: "synthetic",
      directory,
    });

    assert.deepEqual(history.map((item) => item.week), [1, 2]);
    assert.equal(history[0]!.headline, "WEEK 1 HEADLINE");
    assert.equal(history[1]!.rankings.length, 12);
    assert.match(
      history[1]!.nextWeekTeaser!,
      /defend the top ranking/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("never mixes real and synthetic history", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "story-"));

  try {
    await approve(report(1, "synthetic"), 1, "synthetic", directory);
    await approve(report(2, "real"), 2, "real", directory);

    const real = await loadApprovedYahooStoryHistory({
      season: 2026,
      beforeWeek: 3,
      source: "real",
      directory,
    });

    assert.deepEqual(real.map((item) => item.week), [2]);
    assert.equal(real[0]!.source, "real");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ignores modified and rejected reports", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "story-"));

  try {
    const modified = await approve(
      report(1, "synthetic"), 1, "synthetic", directory,
    );
    const rejected = await approve(
      report(2, "synthetic"), 2, "synthetic", directory,
    );

    await writeFile(
      modified,
      report(1, "synthetic") + "\nChanged after approval.",
    );
    await rejectPrivateDraft(rejected);

    const history = await loadApprovedYahooStoryHistory({
      season: 2026,
      beforeWeek: 4,
      source: "synthetic",
      directory,
    });

    assert.equal(history.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("excludes older weekly-only drafts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "story-"));

  try {
    const old = report(1, "synthetic").replace(
      "PROVISIONAL POWER RANKINGS",
      "PROVISIONAL WEEKLY ALL-PLAY",
    );

    await approve(old, 1, "synthetic", directory);

    const history = await loadApprovedYahooStoryHistory({
      season: 2026,
      beforeWeek: 2,
      source: "synthetic",
      directory,
    });

    assert.equal(history.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing history directory returns no articles", async () => {
  const directory = path.join(
    tmpdir(),
    `story-history-nonexistent-${process.pid}`,
  );

  const history = await loadApprovedYahooStoryHistory({
    season: 2026,
    beforeWeek: 2,
    source: "synthetic",
    directory,
  });

  assert.deepEqual(history, []);
});

test("uses the newest approved revision, not an unapproved rewrite", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "story-"));

  try {
    const original = report(2, "synthetic");
    await approve(original, 2, "synthetic", directory);

    const revised = original.replace(
      "Can Team 1 defend the top ranking?",
      "Can Team 2 challenge the leader?",
    );

    const revisionPath = await saveYahooChaosDraft(
      revised, 2026, 2, "synthetic", directory, true,
    );

    const request = {
      season: 2026,
      beforeWeek: 3,
      source: "synthetic" as const,
      directory,
    };

    const before = await loadApprovedYahooStoryHistory(request);
    assert.match(before[0]!.nextWeekTeaser!, /Team 1 defend/);

    await approvePrivateDraft(revisionPath, hashDraft(revised));

    const after = await loadApprovedYahooStoryHistory(request);
    assert.equal(after.length, 1);
    assert.match(after[0]!.nextWeekTeaser!, /Team 2 challenge/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
