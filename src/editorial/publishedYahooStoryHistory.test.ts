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
} from "../publication/draftApproval.js";
import {
  recordReportPublication,
  type ShareRequest,
} from "../publication/reportPublication.js";
import { saveYahooChaosDraft } from "../reports/yahooChaosSave.js";
import {
  loadPublishedYahooStoryHistory,
} from "./publishedYahooStoryHistory.js";

const leagueId = "league-of-extraordinary-men";

function article(week: number, revised = false): string {
  const rankings = Array.from(
    { length: 12 },
    (_, i) => `${i + 1}. Team ${i + 1} — 50/100`,
  );

  return [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
    "",
    "🏀 *THE WEEKLY CHAOS REPORT*",
    `*LEAGUE OF EXTRAORDINARY MEN — WEEK ${week}*`,
    `_WEEK ${week} STORY_`,
    "",
    "📊 *PROVISIONAL POWER RANKINGS*",
    ...rankings,
    "",
    "🏆 *THE CHAOS AWARDS*",
    "Steamroller: Team 1.",
    "",
    "📰 *THE BIG PICTURE*",
    revised
      ? "Team 2 challenges the leader."
      : "Team 1 leads the rankings.",
    "",
    "🔮 *NEXT WEEK'S DRAMA*",
    revised
      ? "Can Team 2 take the top spot?"
      : "Can Team 1 defend #1?",
    "",
    "story ".repeat(300),
    "⚠️ Power Rankings remain provisional.",
  ].join("\n");
}

async function makeApproved(
  directory: string,
  week: number,
  revised = false,
): Promise<ShareRequest> {
  const text = article(week, revised);
  const draftPath = await saveYahooChaosDraft(
    text, 2026, week, "real", directory, revised,
  );

  await approvePrivateDraft(draftPath, hashDraft(text));

  return {
    draftPath,
    leagueId,
    reportId: `2026-week-${week}`,
    platform: "whatsapp",
    destinationId: "main-league-chat",
  };
}

function historyRequest(directory: string, beforeWeek = 3) {
  return {
    leagueId,
    season: 2026,
    beforeWeek,
    directory: path.join(directory, "receipts"),
  };
}

test("approved but unshared articles are excluded", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    await makeApproved(directory, 2);

    const stories = await loadPublishedYahooStoryHistory(
      historyRequest(directory),
    );

    assert.deepEqual(stories, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("shared articles become verified narrative history", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    const request = await makeApproved(directory, 2);

    await recordReportPublication(
      request, "SHARED", historyRequest(directory).directory,
    );

    const stories = await loadPublishedYahooStoryHistory(
      historyRequest(directory),
    );

    assert.equal(stories.length, 1);
    assert.equal(stories[0]!.week, 2);
    assert.equal(stories[0]!.rankings.length, 12);
    assert.match(stories[0]!.nextWeekTeaser!, /defend #1/);
    assert.doesNotMatch(stories[0]!.article, /PRIVATE DRAFT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("multiple destinations count as one storyline", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    const request = await makeApproved(directory, 2);
    const receipts = historyRequest(directory).directory;

    await recordReportPublication(request, "SHARED", receipts);

    await recordReportPublication(
      { ...request, destinationId: "backup-league-chat" },
      "SHARED",
      receipts,
    );

    const stories = await loadPublishedYahooStoryHistory(
      historyRequest(directory),
    );

    assert.equal(stories.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("conflicting published revisions are rejected", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    const first = await makeApproved(directory, 2);
    const second = await makeApproved(directory, 2, true);
    const receipts = historyRequest(directory).directory;

    await recordReportPublication(first, "SHARED", receipts);

    await assert.rejects(
      recordReportPublication(
        { ...second, destinationId: "backup-league-chat" },
        "SHARED",
        receipts,
      ),
      /Conflicting published articles/,
    );

    const stories = await loadPublishedYahooStoryHistory(
      historyRequest(directory),
    );

    assert.equal(stories.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("history excludes current and future weeks", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    const first = await makeApproved(directory, 1);
    const second = await makeApproved(directory, 2);
    const receipts = historyRequest(directory).directory;

    await recordReportPublication(first, "SHARED", receipts);
    await recordReportPublication(second, "SHARED", receipts);

    const stories = await loadPublishedYahooStoryHistory(
      historyRequest(directory, 2),
    );

    assert.deepEqual(stories.map((s) => s.week), [1]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("altered publication text fails integrity checks", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "published-"));

  try {
    const request = await makeApproved(directory, 2);
    const receipts = historyRequest(directory).directory;

    const { filepath } = await recordReportPublication(
      request, "SHARED", receipts,
    );

    const original = await readFile(filepath, "utf8");

    await writeFile(
      filepath,
      original.replace(
        "Team 1 leads the rankings.",
        "Team 1 trails the rankings.",
      ),
    );

    await assert.rejects(
      loadPublishedYahooStoryHistory(historyRequest(directory)),
      /failed validation|failed verification/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
