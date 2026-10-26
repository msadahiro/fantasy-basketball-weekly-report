import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSharedYahooStory,
} from "./yahooStoryHistory.js";

test("extracts published Week 1 headline and matchup stories", () => {
  const article = [
    "🏀 *WEEKLY POWER RANKINGS*",
    "*LEAGUE OF EXTRAORDINARY MEN — WEEK 1*",
    "",
    "*THE PRESEASON PREDICTIONS ARE ALREADY AGING BADLY* 😂",
    "",
    "⚔️ *MATCHUP MADNESS*",
    "",
    "• *The Robot Has Found Validation*",
    "The robot will use this as evidence that being annoying works.",
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
    "The preseason predictions are already looking questionable.",
    "",
    "🔮 *NEXT WEEK'S DRAMA*",
    "",
    "Can Team 1 defend the top spot?",
  ].join("\n");

  const story = parseSharedYahooStory(
    article,
    "week1-whatsapp.txt",
    2026,
    1,
  );

  assert.equal(
    story.headline,
    "THE PRESEASON PREDICTIONS ARE ALREADY AGING BADLY 😂",
  );
  assert.equal(story.rankings.length, 12);
  assert.equal(story.awards.length, 1);
  assert.equal(story.storylines.length, 2);
  assert.match(story.storylines[0]!, /Robot Has Found Validation/);
  assert.match(story.storylines[0]!, /being annoying works/);
  assert.match(story.storylines[1]!, /preseason predictions/);
  assert.equal(
    story.nextWeekTeaser,
    "Can Team 1 defend the top spot?",
  );
});
