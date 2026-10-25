import assert from "node:assert/strict";
import test from "node:test";

import {
  rewriteBigPicture,
  createOpenAITextGenerator,
} from "./aiChaosWriter.js";

const teams = Array.from({ length: 12 }, (_, index) => ({
  id: `team-${index + 1}`,
  name: `Team ${index + 1}`,
}));

const report = [
  "🔒 PRIVATE DRAFT",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  "⚔️ *MATCHUP MADNESS*",
  "Team 1 leads Team 2 by six categories to three.",
  "📊 *PROVISIONAL POWER RANKINGS*",
  "1. Team 1 — 75.0/100",
  "📰 *THE BIG PICTURE*",
  "The league is having a strange week.",
  "🚀 Team 1 remains under scrutiny.",
  "",
  "🔮 *NEXT WEEK'S DRAMA*",
  "The next matchup period awaits.",
].join("\n");

const input = {
  leagueId: "test-league",
  season: 2026,
  week: 1,
  teams,
  report,
};

const paragraph = Array.from(
  { length: 50 },
  (_, index) => index === 0 ? "League" : "analysis",
).join(" ");

test("passes all 12 team styles to the AI", async () => {
  let prompt = "";

  await rewriteBigPicture(input, async (value) => {
    prompt = value;
    return paragraph;
  });

  for (const team of teams) {
    assert.ok(prompt.includes(team.name));
  }

  assert.match(prompt, /deadpan|investigator|announcer/);
  assert.match(prompt, /Do not offer roster/);
});

test("replaces narrative without modifying rankings or scores", async () => {
  const result = await rewriteBigPicture(
    input,
    async () => paragraph,
  );

  assert.ok(result.includes(paragraph));
  assert.ok(result.includes("1. Team 1 — 75.0/100"));
  assert.ok(
    result.includes(
      "Team 1 leads Team 2 by six categories to three.",
    ),
  );
  assert.ok(
    result.includes("🚀 Team 1 remains under scrutiny."),
  );
  assert.ok(!result.includes("The league is having a strange week."));
});

test("rejects invalid AI commentary", async () => {
  for (const invalid of [
    "Too short.",
    paragraph + "\nAnother paragraph.",
    paragraph + " All-Play.",
    paragraph + " Managers should drop players.",
  ]) {
    await assert.rejects(
      rewriteBigPicture(input, async () => invalid),
      /failed validation/,
    );
  }
});

test("requires the expected report section", async () => {
  await assert.rejects(
    rewriteBigPicture(
      { ...input, report: "No Big Picture section" },
      async () => paragraph,
    ),
    /Cannot locate Big Picture section/,
  );
});

test("supports a mocked model API response", async () => {
  const generate = createOpenAITextGenerator(
    {
      OPENAI_API_KEY: "test-only-key",
      OPENAI_MODEL: "test-model",
    },
    async (_url, options) => {
      assert.ok(options, "Expected request options");
      assert.equal(options.method, "POST");

      const body = JSON.parse(options.body as string);
      assert.equal(body.store, false);
      assert.equal(body.model, "test-model");

      return new Response(
        JSON.stringify({
          status: "completed",
          output: [{
            content: [{
              type: "output_text",
              text: paragraph,
            }],
          }],
        }),
        { status: 200 },
      );
    },
  );

  assert.equal(await generate("Test prompt"), paragraph);
});
