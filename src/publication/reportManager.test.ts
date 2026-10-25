import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  exportApprovedDemo,
  getReportStatus,
  listPrivateDrafts,
} from "./reportManager.js";

import { approvePrivateDraft, hashDraft } from "./draftApproval.js";

import { savePrivateDraft } from "./privateDraft.js";
import type { ReportDraft } from "../reports/reportDraft.js";

const demoDraft: ReportDraft = {
  status: "draft",
  source: "synthetic",
  content: [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "🧪 DEMO ONLY — Synthetic statistics",
    "",
    "🏀 WEEK 3 — POWER RANKINGS",
    "Demo Team 7 climbed seven spots.",
    "",
    "DEMO ONLY — Nothing has been sent to WhatsApp.",
  ].join("\n"),
};

async function withFixture(
  run: (paths: {
    filepath: string;
    reports: string;
    exports: string;
  }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "report-manager-"));

  try {
    const reports = path.join(root, "reports");
    const exports = path.join(root, "exports");

    const filepath = await savePrivateDraft(demoDraft, 3, reports);

    await run({ filepath, reports, exports });
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
}

test("lists new reports as unapproved", async () => {
  await withFixture(async ({ reports }) => {
    const drafts = await listPrivateDrafts(reports);

    assert.deepEqual(drafts, [{ week: 3, status: "unapproved" }]);
  });
});

test("lists approved reports correctly", async () => {
  await withFixture(async ({ filepath, reports }) => {
    await approvePrivateDraft(filepath, hashDraft(demoDraft.content));

    assert.deepEqual(await listPrivateDrafts(reports), [
      { week: 3, status: "approved" },
    ]);

    assert.equal(await getReportStatus(3, reports), "approved");
  });
});

test("rejects exporting a modified report", async () => {
  await withFixture(async ({ filepath, reports, exports }) => {
    await approvePrivateDraft(filepath, hashDraft(demoDraft.content));

    await writeFile(filepath, demoDraft.content + "\nEdited commentary.");

    await assert.rejects(
      exportApprovedDemo(3, reports, exports),
      /status is modified/,
    );
  });
});

test("exports approved demos with clear labeling", async () => {
  await withFixture(async ({ filepath, reports, exports }) => {
    await approvePrivateDraft(filepath, hashDraft(demoDraft.content));

    const destination = await exportApprovedDemo(3, reports, exports);

    const content = await readFile(destination, "utf8");

    assert.match(content, /APPROVED DEMO — SYNTHETIC DATA ONLY/);

    assert.match(content, /NOT REAL LEAGUE RESULTS/);
    assert.match(content, /Demo Team 7/);

    assert.doesNotMatch(content, /PRIVATE DRAFT — NOT APPROVED/);
  });
});

test("does not overwrite an existing export", async () => {
  await withFixture(async ({ filepath, reports, exports }) => {
    await approvePrivateDraft(filepath, hashDraft(demoDraft.content));

    await exportApprovedDemo(3, reports, exports);

    await assert.rejects(exportApprovedDemo(3, reports, exports), {
      code: "EEXIST",
    });
  });
});
