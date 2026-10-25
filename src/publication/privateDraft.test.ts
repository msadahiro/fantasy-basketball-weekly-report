import assert from "node:assert/strict";
import test from "node:test";

import { mkdtemp, readFile, rm } from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import { savePrivateDraft } from "./privateDraft.js";
import type { ReportDraft } from "../reports/reportDraft.js";

const exampleDraft: ReportDraft = {
  status: "draft",
  source: "synthetic",
  content: "PRIVATE DRAFT — NOT APPROVED\n" + "DEMO ONLY — Synthetic report",
};

test("saves a private report locally", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fantasy-report-"));

  try {
    const filepath = await savePrivateDraft(exampleDraft, 3, directory);

    const content = await readFile(filepath, "utf8");

    assert.equal(content, exampleDraft.content);
    assert.match(filepath, /demo-week-3\.txt$/);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});

test("does not overwrite an existing draft", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fantasy-report-"));

  try {
    await savePrivateDraft(exampleDraft, 3, directory);

    await assert.rejects(savePrivateDraft(exampleDraft, 3, directory), {
      code: "EEXIST",
    });
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
});
