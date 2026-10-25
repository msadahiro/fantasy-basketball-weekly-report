import assert from "node:assert/strict";
import test from "node:test";

import {
  rewriteMatchupCommentary,
} from "./aiMatchupWriter.js";

const teams = Array.from({ length: 12 }, (_, i) => ({
  id: `team-${i + 1}`,
  name: `Team ${i + 1}`,
}));

const matchups = Array.from({ length: 6 }, (_, i) => ({
  homeId: teams[i * 2]!.id,
  awayId: teams[i * 2 + 1]!.id,
  homeWins: 6,
  awayWins: 3,
  ties: 0,
  uncertain: 0,
}));

const comments = [
  "Confidence arrived early; the statistical evidence apparently missed its connecting flight.",
  "Management remains upbeat, a remarkable achievement given the surrounding scoreboard situation.",
  "The arena imagined a parade; the numbers quietly requested a recount.",
  "Optimism took the floor, immediately discovering a formidable opponent in arithmetic.",
  "The press office promised fireworks; the category totals delivered a damp sparkler.",
  "This franchise has a complicated relationship with momentum and an excellent publicist.",
];

const report = [
  "🔒 PRIVATE DRAFT",
  "⚔️ *MATCHUP MADNESS*",
  ...matchups.map((m, i) =>
    `• Team ${i * 2 + 1} 6-3 Team ${i * 2 + 2}. ` +
    `The category edge goes to Team ${i * 2 + 1}.`
  ),
  "",
  "📊 *PROVISIONAL POWER RANKINGS*",
  "1. Team 1 — 75.0/100",
  "2. Team 2 — 72.0/100",
].join("\n");

const input = {
  leagueId: "test-league",
  season: 2026,
  week: 1,
  teams,
  matchups,
  report,
};

function response(lines = comments): string {
  return JSON.stringify({
    commentary: lines.map((text, i) => ({
      matchup: i + 1,
      text,
    })),
  });
}

test("sends all twelve teams and their styles to AI", async () => {
  let prompt = "";

  await rewriteMatchupCommentary(input, async (value) => {
    prompt = value;
    return response();
  });

  for (const team of teams) {
    assert.ok(prompt.includes(`"name": "${team.name}"`));
  }

  assert.match(prompt, /deadpan/);
  assert.match(prompt, /investigator/);
  assert.match(prompt, /announcer/);
  assert.match(prompt, /pundit/);
  assert.match(prompt, /statistical/);
  assert.match(prompt, /satirical/);
});

test("adds six comments without modifying factual recaps", async () => {
  const result = await rewriteMatchupCommentary(
    input,
    async () => response(),
  );

  for (const line of report.split("\n")) {
    assert.ok(result.includes(line));
  }

  for (const comment of comments) {
    assert.ok(result.includes(`_${comment}_`));
  }

  assert.equal(
    result.split("\n").filter((line) => line.startsWith("  _")).length,
    6,
  );
});

test("rejects malformed or incomplete AI output", async () => {
  await assert.rejects(
    rewriteMatchupCommentary(input, async () => "not JSON"),
    /valid JSON/,
  );

  await assert.rejects(
    rewriteMatchupCommentary(
      input,
      async () => response(comments.slice(0, 5)),
    ),
    /six matchup comments/,
  );
});

test("rejects unsupported claims and duplicate commentary", async () => {
  for (const badComment of [
    "The trade committee has gathered to discuss this truly questionable transaction today.",
    "Management scored 999 points, an achievement unseen in modern fantasy basketball.",
    "The team clinched a stunning victory and celebrated before the weekend ended.",
    "The league's All-Play department has officially declared this entire operation ridiculous.",
  ]) {
    await assert.rejects(
      rewriteMatchupCommentary(
        input,
        async () => response([badComment, ...comments.slice(1)]),
      ),
      /failed validation/,
    );
  }

  await assert.rejects(
    rewriteMatchupCommentary(
      input,
      async () => response(Array(6).fill(comments[0])),
    ),
    /repeated matchup commentary/,
  );
});

test("rejects matchup facts inconsistent with report", async () => {
  await assert.rejects(
    rewriteMatchupCommentary(
      {
        ...input,
        report: report.replace(
          "Team 1 6-3 Team 2",
          "Team 1 5-4 Team 2",
        ),
      },
      async () => response(),
    ),
    /disagrees with source facts/,
  );
});
