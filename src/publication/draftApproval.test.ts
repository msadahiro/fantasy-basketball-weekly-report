import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
} from "./draftApproval.js";

const original =
  "PRIVATE DRAFT — NOT APPROVED\n" +
  "DEMO ONLY\n" +
  "Demo Team 7 climbed seven spots.";

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "draft-approval-"));

  const filepath = path.join(directory, "demo-week-3.txt");
  await writeFile(filepath, original);

  return { directory, filepath };
}

test("new drafts are unapproved", async () => {
  const { directory, filepath } = await fixture();

  try {
    assert.equal(await getDraftApprovalStatus(filepath), "unapproved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("approves the exact reviewed content", async () => {
  const { directory, filepath } = await fixture();

  try {
    await approvePrivateDraft(filepath, hashDraft(original));

    assert.equal(await getDraftApprovalStatus(filepath), "approved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("editing an approved draft invalidates approval", async () => {
  const { directory, filepath } = await fixture();

  try {
    await approvePrivateDraft(filepath, hashDraft(original));

    await writeFile(filepath, original + "\nNew commentary.");

    assert.equal(await getDraftApprovalStatus(filepath), "modified");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cannot approve content changed since preview", async () => {
  const { directory, filepath } = await fixture();

  try {
    const preview = await readFile(filepath, "utf8");
    const previewHash = hashDraft(preview);

    await writeFile(filepath, preview + "\nEdited.");

    await assert.rejects(
      approvePrivateDraft(filepath, previewHash),
      /Draft changed since preview/,
    );

    assert.equal(await getDraftApprovalStatus(filepath), "unapproved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
