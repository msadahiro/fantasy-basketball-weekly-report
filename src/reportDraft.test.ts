import assert from "node:assert/strict";
import test from "node:test";

import { createReportDraft } from "./reportDraft.js";
import type { WeeklyRankingHistory } from "./history.js";

function sampleHistory(): WeeklyRankingHistory {
  const previousRanks = [3, 4, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12];

  return {
    week: 3,
    rankings: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i + 1}`,
      team: `Demo Team ${i + 1}`,
      powerRank: i + 1,
      allPlayRank: i + 1,
      previousPowerRank: previousRanks[i]!,
      movement: previousRanks[i]! - (i + 1),
      powerScore: (12 - i) / 13,
      weeklyCategoryWinRate: (12 - i) / 13,
      seasonCategoryWinRate: 0.5,
      seasonCategoryWins: 55,
      seasonCategoryLosses: 44,
      seasonCategoryTies: 0,
    })),
  };
}

test("generates a private report with all 12 teams", () => {
  const draft = createReportDraft(sampleHistory());

  assert.equal(draft.status, "draft");
  assert.equal(draft.source, "synthetic");

  assert.match(draft.content, /PRIVATE DRAFT/);
  assert.match(draft.content, /DEMO ONLY/);
  assert.match(draft.content, /WEEK 3/);

  for (let i = 1; i <= 12; i++) {
    assert.ok(draft.content.includes(`Demo Team ${i}`));
  }
});

test("includes tied movement awards", () => {
  const draft = createReportDraft(sampleHistory());

  assert.match(
    draft.content,
    /Biggest Riser: Demo Team 1 \(2 spots\), Demo Team 2 \(2 spots\)/,
  );

  assert.match(
    draft.content,
    /Biggest Fall: Demo Team 3 \(2 spots\), Demo Team 4 \(2 spots\)/,
  );
});

test("rejects incomplete rankings", () => {
  const history = sampleHistory();
  history.rankings.pop();

  assert.throws(
    () => createReportDraft(history),
    /Invalid weekly ranking snapshot/,
  );
});
