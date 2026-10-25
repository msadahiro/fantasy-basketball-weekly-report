import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { saveYahooChaosDraft } from "./yahooChaosSave.js";
import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
  rejectPrivateDraft,
} from "../publication/draftApproval.js";

const demo = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  "🧪 DEMO ONLY",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  "word ".repeat(360),
].join("\n");

const real = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  "⚠️ MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  "📊 *PROVISIONAL WEEKLY ALL-PLAY*",
  "word ".repeat(360),
].join("\n");

test("saves synthetic reports as unapproved private drafts", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    const filepath = await saveYahooChaosDraft(
      demo, 2026, 3, "synthetic", directory,
    );

    assert.equal(await readFile(filepath, "utf8"), demo);
    assert.equal(
      await getDraftApprovalStatus(filepath),
      "unapproved",
    );
    assert.match(filepath, /demo-yahoo-chaos/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not overwrite an existing Yahoo draft", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    await saveYahooChaosDraft(
      demo, 2026, 3, "synthetic", directory,
    );

    await assert.rejects(
      saveYahooChaosDraft(
        demo, 2026, 3, "synthetic", directory,
      ),
      { code: "EEXIST" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("real provisional reports use existing approval workflow", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    const filepath = await saveYahooChaosDraft(
      real, 2026, 1, "real", directory,
    );

    assert.equal(
      await getDraftApprovalStatus(filepath),
      "unapproved",
    );

    await approvePrivateDraft(filepath, hashDraft(real));

    assert.equal(
      await getDraftApprovalStatus(filepath),
      "approved",
    );

    await writeFile(filepath, real + "\nEdited.");

    assert.equal(
      await getDraftApprovalStatus(filepath),
      "modified",
    );

    await rejectPrivateDraft(filepath);

    assert.equal(
      await getDraftApprovalStatus(filepath),
      "rejected",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects missing provenance markers and invalid lengths", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    await assert.rejects(
      saveYahooChaosDraft(
        demo, 2026, 1, "real", directory,
      ),
      /provisional Yahoo markers/,
    );

    await assert.rejects(
      saveYahooChaosDraft(
        "PRIVATE DRAFT\nDEMO ONLY\nTHE WEEKLY CHAOS REPORT",
        2026, 1, "synthetic", directory,
      ),
      /350-450 words/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("power ranking drafts have separate filenames and can be approved", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    const powerReport = real.replace(
      "PROVISIONAL WEEKLY ALL-PLAY",
      "PROVISIONAL POWER RANKINGS",
    );

    const oldPath = await saveYahooChaosDraft(
      real, 2026, 3, "real", directory,
    );

    const powerPath = await saveYahooChaosDraft(
      powerReport, 2026, 3, "real", directory,
    );

    assert.notEqual(oldPath, powerPath);
    assert.match(powerPath, /yahoo-provisional-power-chaos/);

    await approvePrivateDraft(
      powerPath,
      hashDraft(powerReport),
    );

    assert.equal(
      await getDraftApprovalStatus(powerPath),
      "approved",
    );

    assert.equal(
      await getDraftApprovalStatus(oldPath),
      "unapproved",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("explicit revisions preserve the original draft", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "yahoo-chaos-"),
  );

  try {
    const first = await saveYahooChaosDraft(
      real, 2026, 3, "real", directory,
    );

    const revised = real.replace(
      "word word word",
      "updated word word",
    );

    const second = await saveYahooChaosDraft(
      revised, 2026, 3, "real", directory, true,
    );

    assert.match(second, /-v2\.txt$/);
    assert.equal(await readFile(first, "utf8"), real);
    assert.equal(await readFile(second, "utf8"), revised);
    assert.equal(await getDraftApprovalStatus(second), "unapproved");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
