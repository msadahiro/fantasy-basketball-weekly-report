import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
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


    // Create varied synthetic outcomes while preserving nine categories.
    const fixtureCells = rows.map((row) => row.split(","));

    // Columns where the higher-numbered team originally leads.
    const swingColumns = [2, 4, 5, 6, 7, 8, 9, 10];
    const swingCounts = [4, 3, 0, 2, 1, 5];

    for (let matchup = 0; matchup < 6; matchup++) {
      const opponent = 11 - matchup;

      for (const column of swingColumns.slice(0, swingCounts[matchup]!)) {
        const original = fixtureCells[matchup]![column]!;
        fixtureCells[matchup]![column] =
          fixtureCells[opponent]![column]!;
        fixtureCells[opponent]![column] = original;
      }
    }

    // Tie turnovers in matchup two to produce a 4-4-1 score.
    fixtureCells[10]![10] = fixtureCells[1]![10]!;

    const expectedOutcomes = [
      [5, 4, 0],
      [4, 4, 1],
      [1, 8, 0],
      [3, 6, 0],
      [2, 7, 0],
      [6, 3, 0],
    ];

    for (let matchup = 0; matchup < 6; matchup++) {
      const home = fixtureCells[matchup]!;
      const away = fixtureCells[11 - matchup]!;
      let homeWins = 0;
      let awayWins = 0;
      let ties = 0;

      for (let column = 2; column <= 10; column++) {
        const homeValue = Number(home[column]);
        const awayValue = Number(away[column]);

        // Lower turnovers are better; higher is better elsewhere.
        const difference = column === 10
          ? awayValue - homeValue
          : homeValue - awayValue;

        if (difference > 0) homeWins++;
        else if (difference < 0) awayWins++;
        else ties++;
      }

      assert.deepEqual(
        [homeWins, awayWins, ties],
        expectedOutcomes[matchup],
        `Unexpected synthetic matchup ${matchup + 1}`,
      );
    }

    for (let i = 0; i < rows.length; i++) {
      rows[i] = fixtureCells[i]!.join(",");
    }

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

    const stories = [
      {
        headline: "Team 1 Holds the Door Against Team 12",
        paragraph:
          "Team 1 is barely ahead of Team 12, yet the confidence gap " +
          "feels enormous. Somebody has already ordered a parade float " +
          "on credit.",
      },
      {
        headline: "Team 2 and Team 11 Invent Gridlock",
        paragraph:
          "Team 2 and Team 11 have constructed a stalemate so elaborate " +
          "that both sides are claiming progress. Absolutely nobody has " +
          "offered evidence of movement.",
      },
      {
        headline: "Team 10 Brings a Bulldozer to Team 3",
        paragraph:
          "Team 10 has Team 3 staring at a very large hill. The " +
          "motivational speech is ready; unfortunately, nobody " +
          "remembered to provide the climbing equipment.",
      },
      {
        headline: "Team 9 Opens a Comfortable Gap on Team 4",
        paragraph:
          "Team 9 seems comfortably ahead of Team 4, who is treating " +
          "the situation like a bad restaurant review: ignore it, " +
          "complain privately, and hope nobody notices.",
      },
      {
        headline: "Team 8 Turns Up the Heat on Team 5",
        paragraph:
          "Team 8 has Team 5 practicing the thousand-yard stare. The " +
          "explanation is patience, which sounds suspiciously like " +
          "waiting for somebody else's luck to run out.",
      },
      {
        headline: "Team 6 Makes Team 7 Answer Difficult Questions",
        paragraph:
          "Team 6 keeps smiling at Team 7 like this is a friendly " +
          "neighborhood gathering. Team 7 has quietly started looking " +
          "for the nearest emergency exit.",
      },
    ];

    const matchupResponse = JSON.stringify({
      stories: stories.map((story, index) => ({
        matchup: index + 1,
        ...story,
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
    "Write exactly six distinct matchup stories"
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

    function run(ai: boolean, extraOptions: string[] = []) {
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

      args.push(...extraOptions);

      return spawnSync(process.execPath, args, {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 20000,
        env: {
          ...process.env,
          OPENAI_API_KEY: ai ? "mock-only-key" : "",
          OPENAI_MODEL: ai ? "mock-model" : "",
        },
      });
    }

    const baseline = run(false);
    const ai = run(true);

    assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

    assert.equal(ai.status, 0, ai.stderr || ai.stdout);

    // Export verified editorial facts without calling an AI service.
    const packetPath = join(directory, "editorial-packet.json");
    const responsePath = join(directory, "editorial-response.json");

    const exported = run(false, [
      "--export-editorial",
      packetPath,
    ]);

    assert.equal(
      exported.status,
      0,
      exported.stderr || exported.stdout,
    );

    const packet = JSON.parse(
      readFileSync(packetPath, "utf8"),
    ) as {
      schemaVersion: number;
      kind: string;
      leagueId: string;
      season: number;
      week: number;
      source: string;
      factsHash: string;
      matchups: Array<{
        homeWins: number;
        awayWins: number;
        ties: number;
        categoryComparisons: Array<{
          key: string;
          homeValue: string;
          awayValue: string;
          leader: string;
        }>;
      }>;
    };

    assert.equal(packet.schemaVersion, 1);
    assert.equal(packet.kind, "weekly-chaos-editorial-packet");
    assert.equal(packet.source, "synthetic");
    assert.equal(packet.season, 2026);
    assert.equal(packet.week, 1);
    assert.match(packet.factsHash, /^[a-f0-9]{64}$/);
    assert.equal(packet.matchups.length, 6);

    const expectedCategories = [
      "fg_pct", "ft_pct", "threes", "points",
      "rebounds", "assists", "steals", "blocks",
      "turnovers",
    ];

    for (const matchup of packet.matchups) {
      assert.deepEqual(
        matchup.categoryComparisons.map((item) => item.key),
        expectedCategories,
      );
    }

    assert.equal(
      packet.matchups[0]!.categoryComparisons[0]!.homeValue,
      "0.496",
    );

    assert.equal(
      packet.matchups[1]!.categoryComparisons[8]!.leader,
      "tie",
    );

    const expectedScores = [
      [5, 4, 0],
      [4, 4, 1],
      [1, 8, 0],
      [3, 6, 0],
      [2, 7, 0],
      [6, 3, 0],
    ];

    for (let i = 0; i < 6; i++) {
      const matchup = packet.matchups[i]!;

      assert.deepEqual(
        [matchup.homeWins, matchup.awayWins, matchup.ties],
        expectedScores[i],
      );
    }

    // Simulate a ChatGPT-authored editorial response.
    const editorialResponse = {
      schemaVersion: 1,
      kind: "weekly-chaos-editorial-response",
      leagueId: packet.leagueId,
      season: packet.season,
      week: packet.week,
      source: packet.source,
      factsHash: packet.factsHash,
      stories: stories.map((story, index) => ({
        matchup: index + 1,
        ...story,
      })),
      bigPicture,
    };

    writeFileSync(
      responsePath,
      JSON.stringify(editorialResponse, null, 2),
    );

    // Import must work without OPENAI_API_KEY or OPENAI_MODEL.
    const imported = run(false, [
      "--import-editorial",
      responsePath,
    ]);

    assert.equal(
      imported.status,
      0,
      imported.stderr || imported.stdout,
    );

    // Both editorial paths should produce the same report.
    assert.equal(imported.stdout, ai.stdout);

    // Save imported writing privately in an isolated directory.
    const draftDirectory = join(directory, "private-drafts");
    const draftName =
      "demo-yahoo-power-chaos-season-2026-week-1.txt";
    const draftPath = join(draftDirectory, draftName);

    const saveOptions = [
      "--import-editorial",
      responsePath,
      "--save",
      "--draft-dir",
      draftDirectory,
    ];

    const saved = run(false, saveOptions);

    assert.equal(
      saved.status,
      0,
      saved.stderr || saved.stdout,
    );

    const savedReport = readFileSync(draftPath, "utf8");

    assert.match(savedReport, /PRIVATE DRAFT/);
    assert.match(savedReport, /DEMO ONLY/);
    assert.ok(savedReport.includes(stories[0]!.headline));
    assert.match(saved.stdout, /Not approved or published/);

    // Never silently overwrite an existing draft.
    const duplicateSave = run(false, saveOptions);

    assert.notEqual(duplicateSave.status, 0);
    assert.match(duplicateSave.stderr, /EEXIST/);
    assert.deepEqual(readdirSync(draftDirectory), [draftName]);

    // Explicit revision mode creates a separate private draft.
    const revision = run(false, [
      "--import-editorial",
      responsePath,
      "--save-revision",
      "--draft-dir",
      draftDirectory,
    ]);

    assert.equal(
      revision.status,
      0,
      revision.stderr || revision.stdout,
    );

    const revisionName =
      "demo-yahoo-power-chaos-season-2026-week-1-v2.txt";

    assert.deepEqual(
      readdirSync(draftDirectory).sort(),
      [draftName, revisionName].sort(),
    );

    assert.equal(
      readFileSync(join(draftDirectory, revisionName), "utf8"),
      savedReport,
    );

    assert.match(revision.stdout, /Not approved or published/);

    // Reject editorial content with the wrong factual fingerprint.
    const stalePath = join(directory, "stale-editorial.json");

    writeFileSync(
      stalePath,
      JSON.stringify({
        ...editorialResponse,
        factsHash: "0".repeat(64),
      }),
    );

    const stale = run(false, [
      "--import-editorial",
      stalePath,
    ]);

    assert.notEqual(stale.status, 0);
    assert.match(
      stale.stderr,
      /Editorial response does not match this verified report/,
    );

    // Import cannot run alongside automatic AI generation.
    const conflictingModes = run(false, [
      "--import-editorial",
      responsePath,
      "--ai",
    ]);

    assert.notEqual(conflictingModes.status, 0);
    assert.match(
      conflictingModes.stderr,
      /cannot be combined/,
    );

    const baselineRows = baseline.stdout
      .split("\n")
      .filter((line) => line.startsWith("• "));

    const rankingRows = baseline.stdout
      .split("\n")
      .filter((line) => /^\d+\.\s/.test(line));

    assert.equal(baselineRows.length, 6);
    assert.equal(rankingRows.length, 12);

    // The six original generic recaps must be replaced.
    const aiLines = ai.stdout.split("\n");

    const aiHeadlines = aiLines.filter(
      (line) => line.startsWith("• *"),
    );

    assert.equal(aiHeadlines.length, 6);

    for (const original of baselineRows) {
      assert.ok(
        !aiLines.includes(original),
        `Generic recap survived: ${original}`,
      );
    }

    // All six headline-and-paragraph combinations appear once.
    for (const story of stories) {
      const expected =
        `• *${story.headline}*\n  ${story.paragraph}`;

      assert.equal(
        ai.stdout.split(expected).length - 1,
        1,
        `Missing or repeated story: ${story.headline}`,
      );
    }

    // No old appended commentary should remain.
    assert.equal(
      aiLines.filter((line) => /^  _.*_$/.test(line)).length,
      0,
    );

    // Power rankings must remain exactly unchanged.
    for (const row of rankingRows) {
      assert.equal(
        aiLines.filter((line) => line === row).length,
        1,
        `Power ranking changed: ${row}`,
      );
    }

    // Awards must also remain exactly unchanged.
    const awardRows = baseline.stdout
      .split("\n")
      .filter((line) => /^[🧹🎩🧊]/u.test(line));

    assert.equal(awardRows.length, 3);

    for (const row of awardRows) {
      assert.ok(aiLines.includes(row), `Award changed: ${row}`);
    }

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

    if (process.env.CHAOS_PREVIEW === "1") {
      console.log("\n===== SYNTHETIC WEEKLY CHAOS REPORT =====\n");
      console.log(ai.stdout);
    }

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
