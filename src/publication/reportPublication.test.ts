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
import { saveYahooChaosDraft } from "../reports/yahooChaosSave.js";
import {
  loadReportPublication,
  prepareReportForPlatform,
  recordReportPublication,
  type ShareRequest,
} from "./reportPublication.js";

function report(source: "real" | "synthetic"): string {
  const marker = source === "real"
    ? "MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED"
    : "DEMO ONLY — Synthetic statistics";

  const rankings = Array.from(
    { length: 12 },
    (_, i) => `${i + 1}. Team ${i + 1} — 50/100`,
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
    "Steamroller: Team 1.",
    "",
    "📰 *THE BIG PICTURE*",
    "Team 1 leads the rankings.",
    "story ".repeat(310),
    "",
    "⚠️ Power Rankings remain provisional.",
  ].join("\n");
}

const base = {
  leagueId: "league-of-extraordinary-men",
  reportId: "2026-week-3",
  platform: "whatsapp" as const,
  destinationId: "main-league-chat",
};

async function setup(
  directory: string,
  source: "real" | "synthetic" = "real",
  approve = true,
): Promise<ShareRequest> {
  const content = report(source);

  const draftPath = await saveYahooChaosDraft(
    content,
    2026,
    3,
    source,
    directory,
  );

  if (approve) {
    await approvePrivateDraft(
      draftPath,
      hashDraft(content),
    );
  }

  return { ...base, draftPath };
}

test("records an approved WhatsApp article", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const request = await setup(directory);
    const publicationDirectory = path.join(
      directory,
      "receipts",
    );

    const prepared = await prepareReportForPlatform(
      request,
    );

    assert.doesNotMatch(
      prepared.shareText,
      /PRIVATE DRAFT|DEMO ONLY|All-Play/i,
    );

    const result = await recordReportPublication(
      request,
      "SHARED",
      publicationDirectory,
    );

    assert.equal(result.receipt.status, "shared");
    assert.equal(result.receipt.platform, "whatsapp");

    const loaded = await loadReportPublication(
      request,
      publicationDirectory,
    );

    assert.equal(
      loaded?.shareHash,
      hashDraft(prepared.shareText),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("keeps destinations separate and prevents overwrites", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const request = await setup(directory);
    const receipts = path.join(directory, "receipts");

    await recordReportPublication(
      request,
      "SHARED",
      receipts,
    );

    await assert.rejects(
      recordReportPublication(
        request,
        "SHARED",
        receipts,
      ),
      { code: "EEXIST" },
    );

    const secondDestination = {
      ...request,
      destinationId: "secondary-league-chat",
    };

    await recordReportPublication(
      secondDestination,
      "SHARED",
      receipts,
    );

    assert.ok(
      await loadReportPublication(
        secondDestination,
        receipts,
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unapproved, synthetic, and unimplemented platforms", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const unapproved = await setup(
      directory,
      "real",
      false,
    );

    await assert.rejects(
      prepareReportForPlatform(unapproved),
      /Approve the exact current draft/,
    );

    const demo = await setup(
      directory,
      "synthetic",
    );

    await assert.rejects(
      prepareReportForPlatform(demo),
      /Only real Yahoo Power Ranking drafts/,
    );

    await assert.rejects(
      prepareReportForPlatform({
        ...demo,
        platform: "discord",
      }),
      /not implemented yet/,
    );

    await assert.rejects(
      recordReportPublication(
        demo,
        "APPROVE",
        path.join(directory, "receipts"),
      ),
      /Explicit SHARED confirmation/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detects tampering with stored publication text", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-"),
  );

  try {
    const request = await setup(directory);
    const receipts = path.join(directory, "receipts");

    const result = await recordReportPublication(
      request,
      "SHARED",
      receipts,
    );

    const original = await readFile(
      result.filepath,
      "utf8",
    );

    await writeFile(
      result.filepath,
      original.replace(
        "Team 1 leads the rankings.",
        "Team 1 trails the rankings.",
      ),
    );

    await assert.rejects(
      loadReportPublication(request, receipts),
      /failed validation/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects incorrect league, season, and week identifiers", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "identity-"),
  );

  try {
    const request = await setup(directory);

    await assert.rejects(
      prepareReportForPlatform({
        ...request,
        leagueId: "another-league",
      }),
      /Unknown league ID/,
    );

    for (const reportId of ["2026-week-4", "2025-week-3"]) {
      await assert.rejects(
        prepareReportForPlatform({
          ...request,
          reportId,
        }),
        /Report ID does not match/,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a report with the wrong league heading", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "identity-"),
  );

  try {
    const content = report("real").replace(
      "*LEAGUE OF EXTRAORDINARY MEN — WEEK 3*",
      "*ANOTHER LEAGUE — WEEK 3*",
    );

    const draftPath = await saveYahooChaosDraft(
      content, 2026, 3, "real", directory,
    );

    await approvePrivateDraft(
      draftPath,
      hashDraft(content),
    );

    await assert.rejects(
      prepareReportForPlatform({
        ...base,
        draftPath,
      }),
      /Report header does not match/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("recognizes approved versioned draft filenames", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "identity-"),
  );

  try {
    await setup(directory);

    const content = report("real").replace(
      "Team 1 leads the rankings.",
      "Team 1 remains the leader.",
    );

    const draftPath = await saveYahooChaosDraft(
      content, 2026, 3, "real", directory, true,
    );

    await approvePrivateDraft(
      draftPath,
      hashDraft(content),
    );

    assert.match(draftPath, /-v2\.txt$/);

    const prepared = await prepareReportForPlatform({
      ...base,
      draftPath,
    });

    assert.match(
      prepared.shareText,
      /Team 1 remains the leader/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("publication receipts are bound to their draft path", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "identity-"),
  );

  try {
    const request = await setup(directory);
    const receipts = path.join(directory, "receipts");

    await recordReportPublication(
      request,
      "SHARED",
      receipts,
    );

    await assert.rejects(
      loadReportPublication(
        {
          ...request,
          draftPath: "different-report.txt",
        },
        receipts,
      ),
      /failed validation/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("blocks preparation of a conflicting published revision", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "publication-conflict-"),
  );

  try {
    const original = await setup(directory);
    const receipts = path.join(directory, "receipts");

    await recordReportPublication(original, "SHARED", receipts);

    const revisedContent = report("real").replace(
      "Team 1 leads the rankings.",
      "Team 2 takes the lead.",
    );

    const revisedPath = await saveYahooChaosDraft(
      revisedContent,
      2026,
      3,
      "real",
      directory,
      true,
    );

    await approvePrivateDraft(
      revisedPath,
      hashDraft(revisedContent),
    );

    const revisedRequest = {
      ...original,
      draftPath: revisedPath,
      destinationId: "second-league-chat",
    };

    await assert.rejects(
      prepareReportForPlatform(revisedRequest, receipts),
      /Conflicting published articles/,
    );

    const existing = await loadReportPublication(
      original,
      receipts,
    );

    assert.ok(existing);
    assert.equal(existing.draftPath, original.draftPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
