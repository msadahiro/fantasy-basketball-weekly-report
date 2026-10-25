import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  approvePrivateDraft,
  hashDraft,
} from "./draftApproval.js";
import { saveYahooChaosDraft } from "./yahooChaosSave.js";
import {
  prepareYahooShare,
  recordYahooShared,
  loadSharedYahooReport,
} from "./yahooPublication.js";

const realMarker =
  "MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED";

function makeReport(source: "real" | "synthetic"): string {
  const marker = source === "real"
    ? realMarker
    : "DEMO ONLY — Synthetic statistics";

  const rankings = Array.from(
    { length: 12 },
    (_, i) => `${i + 1}. Team ${i + 1} — 50.0/100`,
  );

  return [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    marker,
    "",
    "🏀 *THE WEEKLY CHAOS REPORT*",
    "*LEAGUE OF EXTRAORDINARY MEN — WEEK 3*",
    "_TEST REPORT_",
    "",
    "📊 *PROVISIONAL POWER RANKINGS*",
    ...rankings,
    "",
    "🏆 *THE CHAOS AWARDS*",
    "Steamroller: Team 1 dominated.",
    "",
    "📰 *THE BIG PICTURE*",
    "Team 1 leads the rankings.",
    "story ".repeat(300),
    "",
    "⚠️ Power Rankings remain provisional.",
  ].join("\n");
}

async function createDraft(
  directory: string,
  source: "real" | "synthetic" = "real",
) {
  const content = makeReport(source);

  const filepath = await saveYahooChaosDraft(
    content,
    2026,
    3,
    source,
    directory,
  );

  return { filepath, content };
}

test("unapproved reports cannot be prepared", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const { filepath } = await createDraft(directory);

    await assert.rejects(
      prepareYahooShare(filepath),
      /Approve the exact current draft/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("approved reports produce clean sharing text", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const { filepath, content } = await createDraft(directory);

    await approvePrivateDraft(filepath, hashDraft(content));

    const result = await prepareYahooShare(filepath);

    assert.ok(
      result.shareText.startsWith(
        "🏀 *THE WEEKLY CHAOS REPORT*",
      ),
    );

    assert.doesNotMatch(result.shareText, /PRIVATE DRAFT/);
    assert.doesNotMatch(result.shareText, /DEMO ONLY/);
    assert.doesNotMatch(result.shareText, /All-Play/i);
    assert.match(result.shareText, /POWER RANKINGS/);

    assert.equal(result.draftSha256, hashDraft(content));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sharing requires confirmation and preserves its snapshot", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const { filepath, content } = await createDraft(directory);

    await approvePrivateDraft(filepath, hashDraft(content));

    await assert.rejects(
      recordYahooShared(filepath, "APPROVE"),
      /Explicit SHARED confirmation/,
    );

    const record = await recordYahooShared(
      filepath,
      "SHARED",
    );

    assert.equal(record.draftSha256, hashDraft(content));

    await assert.rejects(
      recordYahooShared(filepath, "SHARED"),
      { code: "EEXIST" },
    );

    await writeFile(
      filepath,
      content + "\nChanged after publication.",
    );

    const saved = await loadSharedYahooReport(filepath);

    assert.equal(saved?.draftText, content);
    assert.equal(saved?.shareSha256, record.shareSha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("synthetic reports cannot be recorded as shared", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const { filepath, content } = await createDraft(
      directory,
      "synthetic",
    );

    await approvePrivateDraft(filepath, hashDraft(content));

    await assert.rejects(
      recordYahooShared(filepath, "SHARED"),
      /Only real Yahoo Power Ranking drafts/,
    );

    assert.equal(
      await loadSharedYahooReport(filepath),
      null,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
