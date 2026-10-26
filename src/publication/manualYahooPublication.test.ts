import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  DEFAULT_LEAGUE_ID,
  getLeagueConfig,
} from "../config/leagueConfig.js";
import {
  recordManualYahooPublication,
} from "./manualYahooPublication.js";
import {
  loadPublishedYahooStoryHistory,
} from "../editorial/publishedYahooStoryHistory.js";

test("imports an already-shared WhatsApp report as editorial history", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "manual-yahoo-publication-"),
  );

  try {
    const articlePath = path.join(
      root,
      "2026-week-1-whatsapp.txt",
    );
    const directory = path.join(root, "manual-receipts");
    const leagueName =
      getLeagueConfig(DEFAULT_LEAGUE_ID).displayName.toUpperCase();

    const article = [
      "🏀 *WEEKLY POWER RANKINGS*",
      `*${leagueName} — WEEK 1*`,
      "",
      "*THE PRESEASON PREDICTIONS ARE AGING BADLY* 😂",
      "",
      "⚔️ *MATCHUP MADNESS*",
      "",
      "• *The Robot Has Found Validation*",
      "The robot is getting too confident.",
      "",
      "📊 *POWER RANKINGS*",
      "_Previous position: preseason ranking_",
      "",
      ...Array.from(
        { length: 12 },
        (_, i) => `${i + 1}. Team ${i + 1} (Preseason #${i + 1})`,
      ),
      "",
      "🏆 *THE CHAOS AWARDS*",
      "",
      "🧹 *Steamroller:* Team 1 — That felt personal.",
      "",
      "📰 *THE BIG PICTURE*",
      "",
      "One week, plenty of chaos.",
      "",
      "🔮 *NEXT WEEK'S DRAMA*",
      "",
      "Can Team 1 stay on top?",
    ].join("\n") + "\n";

    await writeFile(articlePath, article);

    const input = {
      articlePath,
      leagueId: DEFAULT_LEAGUE_ID,
      reportId: "2026-week-1",
      sharedDate: "2026-10-25",
      confirmation: "SHARED" as const,
    };

    await recordManualYahooPublication(input, directory);

    const request = {
      leagueId: DEFAULT_LEAGUE_ID,
      season: 2026,
      beforeWeek: 2,
      directory: path.join(root, "normal-publications"),
      manualDirectory: directory,
    };

    const stories = await loadPublishedYahooStoryHistory(request);

    assert.equal(stories.length, 1);
    assert.equal(stories[0]!.rankings.length, 12);
    assert.equal(stories[0]!.week, 1);
    assert.match(stories[0]!.storylines[0]!, /Robot Has Found/);

    await assert.rejects(
      recordManualYahooPublication(input, directory),
      /EEXIST/,
    );

    await writeFile(articlePath, article + "CHANGED");

    await assert.rejects(
      loadPublishedYahooStoryHistory(request),
      /article changed after import/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
