import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

test("synthetic Yahoo Chaos CLI preserves facts with mocked AI", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "chaos-report-e2e-"));

  try {
    const ids = Array.from(
      { length: 12 },
      (_, i) => `team-${String(i + 1).padStart(2, "0")}`,
    );

    const header =
      "id,name,fg_pct,ft_pct,threes,points,rebounds," +
      "assists,steals,blocks,turnovers";

    const rows = ids.map((id, i) =>
      [
        id,
        `Team ${i + 1}`,
        (0.43 + i * 0.006).toFixed(3),
        (0.7 + (11 - i) * 0.007).toFixed(3),
        25 + i * 3,
        320 + i * 14,
        112 + i * 5,
        60 + i * 3,
        15 + i * 2,
        12 + i,
        60 - i * 2,
      ].join(","),
    );

    const csvPath = join(directory, "week1.csv");
    const pairingsPath = join(directory, "pairings.json");
    const mockPath = join(directory, "mock-ai.cjs");

    writeFileSync(csvPath, [header, ...rows].join("\n") + "\n");

    writeFileSync(
      pairingsPath,
      JSON.stringify({
        season: 2026,
        week: 1,
        pairings: Array.from({ length: 6 }, (_, i) => [ids[i], ids[11 - i]]),
      }),
    );

    const comments = [
      "A confident press release has been issued, though the category totals have expressed reservations.",
      "The numbers have become alarmingly opinionated, and the front office appears personally offended.",
      "A perfectly ordinary scoreboard has somehow inspired the atmosphere of an international incident.",
      "The analysts requested explanations; management responded with optimism and several impressive hand gestures.",
      "An unexpected surge of enthusiasm has been reported, despite a complete absence of confetti.",
      "The league's unofficial committee on dignity has declined to open a formal investigation.",
    ];

    const matchupResponse = JSON.stringify({
      commentary: comments.map((text, index) => ({
        matchup: index + 1,
        text,
      })),
    });

    const bigPicture =
      "The league has managed to turn ordinary category totals " +
      "into a remarkably elaborate public spectacle. Some managers " +
      "are celebrating momentum, while others are studying the " +
      "standings as though the numbers might change under sustained " +
      "eye contact. The newsroom can confirm only one thing: " +
      "everyone arrived with confidence, and the box scores " +
      "appear determined to test it.";

    // The child process receives a mocked fetch implementation.
    // No paid AI service is contacted.
    writeFileSync(
      mockPath,
      `
globalThis.fetch = async (_url, options) => {
  if (_url !== "https://api.openai.com/v1/responses") {
    throw new Error("Unexpected API endpoint");
  }

  const request = JSON.parse(options.body);
  const isMatchup = request.input.includes(
    "Write exactly six distinct comedic comments"
  );

  const text = isMatchup
    ? ${JSON.stringify(matchupResponse)}
    : ${JSON.stringify(bigPicture)};

  return new Response(JSON.stringify({
    status: "completed",
    output: [{
      content: [{
        type: "output_text",
        text
      }]
    }]
  }), { status: 200 });
};
`,
    );

    function run(ai: boolean) {
      const args = ["--import", "tsx"];

      if (ai) {
        args.push("--require", mockPath);
      }

      args.push(
        resolve("src/cli/previewYahooChaos.ts"),
        csvPath,
        pairingsPath,
        "synthetic",
      );

      if (ai) {
        args.push("--ai");
      }

      return spawnSync(process.execPath, args, {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 20000,
        env: {
          ...process.env,
          OPENAI_API_KEY: "mock-only-key",
          OPENAI_MODEL: "mock-model",
        },
      });
    }

    const baseline = run(false);
    const ai = run(true);

    assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

    assert.equal(ai.status, 0, ai.stderr || ai.stdout);

    const baselineRows = baseline.stdout
      .split("\n")
      .filter((line) => line.startsWith("• "));

    const rankingRows = baseline.stdout
      .split("\n")
      .filter((line) => /^\d+\.\s/.test(line));

    assert.equal(baselineRows.length, 6);
    assert.equal(rankingRows.length, 12);

    // Every factual matchup and ranking stays unchanged.
    for (const row of [...baselineRows, ...rankingRows]) {
      assert.ok(ai.stdout.includes(row), row);
    }

    // All six AI comments appear exactly once.
    for (const comment of comments) {
      assert.equal(ai.stdout.split(comment).length - 1, 1);
    }

    assert.equal(
      ai.stdout.split("\n").filter((line) => /^  _.*_$/.test(line)).length,
      6,
    );

    assert.match(ai.stdout, /PRIVATE DRAFT/);
    assert.match(ai.stdout, /DEMO ONLY/);
    assert.match(ai.stdout, /Not saved/);
    assert.doesNotMatch(ai.stdout, /\bAll-Play\b/i);

    const baselineWords = Number(baseline.stdout.match(/\((\d+) words\)/)?.[1]);

    const aiWords = Number(ai.stdout.match(/\((\d+) words\)/)?.[1]);

    assert.ok(Number.isFinite(baselineWords));
    assert.ok(Number.isFinite(aiWords));
    assert.ok(aiWords > baselineWords);
    assert.ok(
      baselineWords >= 350 && baselineWords <= 450,
      `Standard report has ${baselineWords} words`,
    );

    assert.match(baseline.stdout, /defend the #1 ranking\?/);

    assert.match(ai.stdout, /defend the #1 ranking\?/);

    assert.match(
      baseline.stdout,
      /One strong week can change the conversation/,
    );

    assert.doesNotMatch(
      ai.stdout,
      /One strong week can change the conversation/,
    );
    assert.ok(
      aiWords >= 350 && aiWords <= 450,
      `Expected 350-450 AI report words, received ${aiWords}`,
    );

    t.diagnostic(`Baseline report: ${baselineWords} words`);
    t.diagnostic(`AI report: ${aiWords} words`);
    t.diagnostic(
      `350-450 word target: ${
        aiWords >= 350 && aiWords <= 450 ? "MET" : "NEEDS EDITING"
      }`,
    );
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
});
