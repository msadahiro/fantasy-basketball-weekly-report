import assert from "node:assert/strict";
import test from "node:test";

import type { TeamStats } from "../rankings/allPlay.js";
import type { WeeklySnapshot } from "../rankings/powerRankings.js";
import { parseMatchupPairings } from "../data/matchupPairings.js";
import {
  countWords,
  generateWeeklyShow,
  WHATSAPP_MAX_WORDS,
  WHATSAPP_MIN_WORDS,
  type WeeklyShowInput,
} from "./weeklyShow.js";

function makeTeams(week: number): TeamStats[] {
  return Array.from({ length: 12 }, (_, i) => {
    const fgm = 150 + ((i * 11 + week * 13) % 70);
    const fga = 320 + ((i * 17 + week * 7) % 90);
    const fta = 110 + ((i * 11 + week * 5) % 50);
    const ftm = 70 + ((i * 7 + week * 3) % 35);
    const threes = 30 + ((i * 7 + week * 11) % 40);
    return {
      id: `t${i + 1}`,
      name: `Team ${i + 1}`,
      fgm,
      fga,
      ftm,
      fta,
      threes,
      points: 2 * fgm + threes + ftm,
      rebounds: 150 + ((i * 23 + week * 19) % 110),
      assists: 90 + ((i * 13 + week * 17) % 80),
      steals: 25 + ((i * 5 + week * 7) % 25),
      blocks: 15 + ((i * 9 + week * 5) % 28),
      turnovers: 40 + ((i * 7 + week * 11) % 40),
    };
  });
}

const pairings = parseMatchupPairings({
  season: 2026,
  week: 3,
  pairings: [
    ["t1", "t12"],
    ["t2", "t11"],
    ["t3", "t10"],
    ["t4", "t9"],
    ["t5", "t8"],
    ["t6", "t7"],
  ],
});

function input(overrides: Partial<WeeklyShowInput> = {}): WeeklyShowInput {
  return {
    season: 2026,
    week: 3,
    teams: makeTeams(3),
    pairings,
    previousWeeks: [
      { week: 1, teams: makeTeams(1) },
      { week: 2, teams: makeTeams(2) },
    ] as WeeklySnapshot[],
    source: "synthetic",
    style: "playful",
    ...overrides,
  };
}

test("produces six matchups and twelve power rankings", () => {
  const show = generateWeeklyShow(input());
  assert.equal(show.matchups.length, 6);
  assert.equal(show.rankings.length, 12);

  const ranks = show.rankings.map((team) => team.powerRank).sort((a, b) => a - b);
  assert.deepEqual(ranks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("the WhatsApp report lists all twelve teams", () => {
  const show = generateWeeklyShow(input());
  for (let i = 1; i <= 12; i++) {
    assert.ok(
      show.whatsapp.includes(`Team ${i}`),
      `missing Team ${i}`,
    );
  }
});

test("the WhatsApp report stays within 350-450 words", () => {
  const show = generateWeeklyShow(input());
  assert.ok(
    show.wordCount >= WHATSAPP_MIN_WORDS && show.wordCount <= WHATSAPP_MAX_WORDS,
    `word count ${show.wordCount} out of range`,
  );
  assert.equal(show.wordCount, countWords(show.whatsapp));
});

test("includes ranking movement when previous weeks exist", () => {
  const show = generateWeeklyShow(input());
  const moved = show.rankings.some((team) => team.movement !== null);
  assert.ok(moved, "expected at least one movement value");
  assert.match(show.whatsapp, /⬆️|⬇️|➖/);
});

test("week 1 shows NEW baseline with no previous weeks", () => {
  const show = generateWeeklyShow(
    input({ week: 1, teams: makeTeams(1), previousWeeks: [] }),
  );
  assert.ok(show.rankings.every((team) => team.movement === null));
  assert.match(show.whatsapp, /NEW/);
});

test("synthetic reports are clearly labeled as demo data", () => {
  const show = generateWeeklyShow(input({ source: "synthetic" }));
  assert.match(show.whatsapp, /DEMO ONLY — Synthetic statistics/);
  assert.match(show.whatsapp, /PRIVATE DRAFT/);
  assert.match(show.analytics, /Source: synthetic/);
  assert.doesNotMatch(show.whatsapp, /REAL LEAGUE RESULTS/);
});

test("real reports carry the finalized snapshot marker", () => {
  const show = generateWeeklyShow(input({ source: "real" }));
  assert.match(show.whatsapp, /REAL LEAGUE RESULTS — finalized weekly snapshot/);
  assert.doesNotMatch(show.whatsapp, /DEMO ONLY — Synthetic statistics/);
});

test("the private analytics report breaks down every matchup category", () => {
  const show = generateWeeklyShow(input());
  assert.match(show.analytics, /MATCHUP BREAKDOWN/);
  assert.match(show.analytics, /POWER RANKINGS \(performance-based\)/);
  for (const label of ["FG%", "FT%", "3PM", "PTS", "REB", "AST", "STL", "BLK", "TO"]) {
    assert.ok(show.analytics.includes(label), `analytics missing ${label}`);
  }
  assert.match(show.analytics, /FG% = FGM\/FGA and FT% = FTM\/FTA/);
});

test("rejects a snapshot that is not twelve teams", () => {
  assert.throws(
    () => generateWeeklyShow(input({ teams: makeTeams(3).slice(0, 11) })),
    /exactly 12 teams/,
  );
});

test("rejects previous weeks that are not earlier than the current week", () => {
  assert.throws(
    () =>
      generateWeeklyShow(
        input({ previousWeeks: [{ week: 3, teams: makeTeams(2) }] }),
      ),
    /must come before week/,
  );
});

test("rejects pairings that do not cover the roster", () => {
  const badPairings = parseMatchupPairings({
    season: 2026,
    week: 3,
    pairings: [
      ["t1", "t12"],
      ["t2", "t11"],
      ["t3", "t10"],
      ["t4", "t9"],
      ["t5", "t8"],
      ["t6", "ghost"],
    ],
  });
  assert.throws(
    () => generateWeeklyShow(input({ pairings: badPairings })),
    /unknown team ID/,
  );
});
