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
  "The grand parade was canceled because someone forgot to invite reality.",
  "This franchise has a complicated relationship with momentum and an excellent publicist.",
];

const stories = comments.map((comment, index) => ({
  matchup: index + 1,
  headline: `Team ${index * 2 + 1} Challenges Team ${index * 2 + 2}`,
  paragraph:
    `Team ${index * 2 + 1} showed up confident. ` +
    `Team ${index * 2 + 2} looked unconvinced. ${comment}`,
}));

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

function response(items = stories): string {
  return JSON.stringify({ stories: items });
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

  assert.match(
    prompt,
    /"verifiedRecap": "Team 1 6-3 Team 2/,
  );
  assert.match(prompt, /deadpan/);
  assert.match(prompt, /investigator/);
  assert.match(prompt, /announcer/);
  assert.match(prompt, /pundit/);
  assert.match(prompt, /statistical/);
  assert.match(prompt, /satirical/);
});

test("replaces recap rows with six distinct stories", async () => {
  const result = await rewriteMatchupCommentary(
    input,
    async () => response(),
  );

  const rankingSection = report.slice(
    report.indexOf("📊 *PROVISIONAL POWER RANKINGS*"),
  );

  assert.ok(result.includes(rankingSection));

  for (const original of report.split("\n")) {
    if (original.startsWith("• ")) {
      assert.ok(
        !result.includes(original),
        `Original recap survived: ${original}`,
      );
    }
  }

  for (const story of stories) {
    assert.ok(
      result.includes(
        `• *${story.headline}*\n  ${story.paragraph}`,
      ),
    );
  }

  assert.equal(
    result.split("\n").filter((line) => line.startsWith("• *")).length,
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
      async () => response(stories.slice(0, 5)),
    ),
    /six matchup stories/,
  );
});

test("rejects unsupported claims and duplicate headlines", async () => {
  for (const badComment of [
    "Management is discussing a trade that would change the league.",
    "Management scored 999 points in a single category.",
    "Management clinched the final victory this morning.",
    "The All-Play committee has officially intervened.",
  ]) {
    const invalid = [
      {
        ...stories[0]!,
        paragraph:
          "Team 1 showed up confident. Team 2 looked unconvinced. " +
          badComment,
      },
      ...stories.slice(1),
    ];

    await assert.rejects(
      rewriteMatchupCommentary(
        input,
        async () => response(invalid),
      ),
      /failed validation/,
    );
  }

  const duplicated = stories.map((story) => ({
    ...story,
    headline: "League Office Orders Another Investigation",
  }));

  await assert.rejects(
    rewriteMatchupCommentary(
      input,
      async () => response(duplicated),
    ),
    /repeated matchup headline/,
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
