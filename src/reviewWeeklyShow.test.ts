import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
  rejectPrivateDraft,
} from "./draftApproval.js";

const finalizedReport = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  "✅ REAL LEAGUE RESULTS — finalized weekly snapshot",
  "THE WEEKLY CHAOS REPORT",
  "DRAFT — Nothing has been sent to WhatsApp.",
].join("\n");

async function fixture(content = finalizedReport) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "weekly-review-"));
  const filepath = path.join(directory, "week-weekly-show-week-3.txt");
  await writeFile(filepath, content);
  return { directory, filepath };
}

test("APPROVE records a sha-256 hash of the exact reviewed draft", async () => {
  const { directory, filepath } = await fixture();
  try {
    await approvePrivateDraft(filepath, hashDraft(finalizedReport));
    assert.equal(await getDraftApprovalStatus(filepath), "approved");

    const record = JSON.parse(
      await readFile(`${filepath}.approval.json`, "utf8"),
    );
    assert.equal(record.sha256, hashDraft(finalizedReport));
    assert.equal(record.decision, "approved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("REJECT records rejection and revokes an earlier approval", async () => {
  const { directory, filepath } = await fixture();
  try {
    await approvePrivateDraft(filepath, hashDraft(finalizedReport));
    assert.equal(await getDraftApprovalStatus(filepath), "approved");

    await rejectPrivateDraft(filepath);
    assert.equal(await getDraftApprovalStatus(filepath), "rejected");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a rejected draft stays rejected even if unchanged", async () => {
  const { directory, filepath } = await fixture();
  try {
    await rejectPrivateDraft(filepath);
    assert.equal(await getDraftApprovalStatus(filepath), "rejected");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CANCEL leaves the status unchanged", async () => {
  // CANCEL writes no approval record, so the draft remains unapproved.
  const { directory, filepath } = await fixture();
  try {
    assert.equal(await getDraftApprovalStatus(filepath), "unapproved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("editing an approved draft invalidates the approval", async () => {
  const { directory, filepath } = await fixture();
  try {
    await approvePrivateDraft(filepath, hashDraft(finalizedReport));
    await writeFile(filepath, finalizedReport + "\nSneaky edit.");
    assert.equal(await getDraftApprovalStatus(filepath), "modified");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("approving content changed since preview is refused", async () => {
  const { directory, filepath } = await fixture();
  try {
    const previewHash = hashDraft(finalizedReport);
    await writeFile(filepath, finalizedReport + "\nEdited.");
    await assert.rejects(
      approvePrivateDraft(filepath, previewHash),
      /Draft changed since preview/,
    );
    assert.equal(await getDraftApprovalStatus(filepath), "unapproved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a draft without an eligible marker cannot be approved", async () => {
  const { directory, filepath } = await fixture("just some text");
  try {
    await assert.rejects(
      approvePrivateDraft(filepath, hashDraft("just some text")),
      /Not an eligible private draft/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy approval records without a decision field still read as approved", async () => {
  const { directory, filepath } = await fixture();
  try {
    // Simulate a pre-existing approval written before the decision field.
    await writeFile(
      `${filepath}.approval.json`,
      JSON.stringify(
        {
          version: 1,
          sha256: hashDraft(finalizedReport),
          approvedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    assert.equal(await getDraftApprovalStatus(filepath), "approved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
