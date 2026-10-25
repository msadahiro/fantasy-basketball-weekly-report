import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { importManualWeek } from "./manualImport.js";

function sampleWeek() {
  return {
    season: 2026,
    week: 1,
    finalized: true,
    teams: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-${i + 1}`,
      name: `Demo Team ${i + 1}`,
      fgm: 40,
      fga: 80,
      ftm: 10,
      fta: 12,
      threes: 12,
      points: 102,
      rebounds: 40,
      assists: 25,
      steals: 7,
      blocks: 4,
      turnovers: 15 - i,
    })),
  };
}

async function withWeekFile(
  data: unknown,
  run: (filepath: string) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "manual-week-"));

  try {
    const filepath = path.join(directory, "week.json");

    await writeFile(filepath, JSON.stringify(data, null, 2));

    await run(filepath);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
}

test("imports and ranks a valid manual week", async () => {
  await withWeekFile(sampleWeek(), async (filepath) => {
    const result = await importManualWeek(filepath);

    assert.equal(result.season, 2026);
    assert.equal(result.week, 1);
    assert.equal(result.allPlay.length, 12);
    assert.equal(result.allPlay[0]?.team, "Demo Team 12");
    assert.equal(result.allPlay[0]?.categoryWinRate, 5 / 9);
  });
});

test("rejects an incomplete league", async () => {
  const week = sampleWeek();
  week.teams.pop();

  await withWeekFile(week, async (filepath) => {
    await assert.rejects(() => importManualWeek(filepath));
  });
});

test("rejects inconsistent basketball statistics", async () => {
  const week = sampleWeek();
  week.teams[0]!.points = 999;

  await withWeekFile(week, async (filepath) => {
    await assert.rejects(
      () => importManualWeek(filepath),
      /Points inconsistent with shooting totals/,
    );
  });
});
