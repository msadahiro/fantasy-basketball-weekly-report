import type { TeamStats } from "./allPlay.js";
import { calculateRankingHistory } from "./history.js";
import type { HistoricalRanking } from "./history.js";
import type { WeeklySnapshot } from "./powerRankings.js";
import { detectStorylines } from "./storylines.js";
import { formatStoryline, type WriterStyle } from "./sportswriter.js";
import {
  assertPairingsCoverTeams,
  type MatchupPairings,
} from "./matchupPairings.js";
import {
  calculateMatchup,
  recapMatchup,
  type MatchupResult,
} from "./matchupRecap.js";

export type DataSource = "synthetic" | "real";

export interface WeeklyShowInput {
  season: number;
  week: number;
  teams: TeamStats[];
  pairings: MatchupPairings;
  previousWeeks?: WeeklySnapshot[];
  source: DataSource;
  style?: WriterStyle;
}

export interface WeeklyShow {
  status: "draft";
  source: DataSource;
  week: number;
  matchups: MatchupResult[];
  rankings: HistoricalRanking[];
  whatsapp: string;
  analytics: string;
  wordCount: number;
}

export const WHATSAPP_MIN_WORDS = 350;
export const WHATSAPP_MAX_WORDS = 450;

export function countWords(text: string): number {
  // Count word-like tokens: sequences containing a letter or digit.
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'%.-]*/gu);
  return matches ? matches.length : 0;
}

function movementBadge(movement: number | null): string {
  if (movement === null) return "NEW";
  if (movement > 0) return `⬆️${movement}`;
  if (movement < 0) return `⬇️${Math.abs(movement)}`;
  return "➖";
}

function buildMatchups(
  teams: TeamStats[],
  pairings: MatchupPairings,
): MatchupResult[] {
  assertPairingsCoverTeams(
    pairings,
    teams.map((team) => team.id),
  );

  const byId = new Map(teams.map((team) => [team.id, team]));

  return pairings.pairings.map(([homeId, awayId]) => {
    const home = byId.get(homeId)!;
    const away = byId.get(awayId)!;
    return calculateMatchup(home, away);
  });
}

interface Award {
  title: string;
  team: string;
  detail: string;
}

function buildAwards(
  matchups: MatchupResult[],
  rankings: HistoricalRanking[],
): Award[] {
  const candidates: Award[] = [];

  const biggestWin = [...matchups]
    .filter((m) => m.winner !== "tie")
    .sort((a, b) => b.margin - a.margin)[0];

  if (biggestWin) {
    const winner =
      biggestWin.winner === "home" ? biggestWin.home : biggestWin.away;
    candidates.push({
      title: "💪 Beatdown of the Week",
      team: winner,
      detail: `took ${Math.max(
        biggestWin.homeCategoryWins,
        biggestWin.awayCategoryWins,
      )} of 9 categories`,
    });
  }

  const closest = [...matchups]
    .filter((m) => m.winner !== "tie" && m.margin === 1)
    .sort((a, b) => a.ties - b.ties)[0];

  if (closest) {
    const winner =
      closest.winner === "home" ? closest.home : closest.away;
    const wins = Math.max(
      closest.homeCategoryWins,
      closest.awayCategoryWins,
    );
    const losses = Math.min(
      closest.homeCategoryWins,
      closest.awayCategoryWins,
    );
    const score = `${wins}-${losses}${
      closest.ties ? `-${closest.ties}` : ""
    }`;

    candidates.push({
      title: "🎩 Escape Artist",
      team: winner,
      detail: `survived a ${score} category battle`,
    });
  }

  const topScorer = [...rankings].sort(
    (a, b) => b.weeklyCategoryWinRate - a.weeklyCategoryWinRate,
  )[0];

  if (topScorer) {
    candidates.push({
      title: "🔥 Team of the Week",
      team: topScorer.team,
      detail: `${(topScorer.weeklyCategoryWinRate * 100).toFixed(
        0,
      )}% All-Play category win rate`,
    });
  }

  const topMover = rankings
    .filter((team) => (team.movement ?? 0) > 0)
    .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0))[0];

  if (topMover) {
    candidates.push({
      title: "🚀 Riser of the Week",
      team: topMover.team,
      detail: `up ${topMover.movement} to #${topMover.powerRank}`,
    });
  }

  const cellar = [...rankings].sort(
    (a, b) => a.weeklyCategoryWinRate - b.weeklyCategoryWinRate,
  )[0];

  if (cellar) {
    candidates.push({
      title: "🧊 Rough Week Award",
      team: cellar.team,
      detail: `just ${(cellar.weeklyCategoryWinRate * 100).toFixed(
        0,
      )}% category win rate`,
    });
  }

  // Prefer awards that spotlight different teams so the same squad does not
  // sweep every honor. Fall back to repeats only if we run short.
  const awards: Award[] = [];
  const featured = new Set<string>();

  for (const candidate of candidates) {
    if (featured.has(candidate.team)) continue;
    awards.push(candidate);
    featured.add(candidate.team);
    if (awards.length === 3) break;
  }

  // Fill any remaining spots with distinct teams.
  for (const ranking of [...rankings].sort(
    (a, b) => b.weeklyCategoryWinRate - a.weeklyCategoryWinRate,
  )) {
    if (awards.length === 3) break;
    if (featured.has(ranking.team)) continue;

    awards.push({
      title: "🎯 On the Radar",
      team: ranking.team,
      detail:
        `${(ranking.weeklyCategoryWinRate * 100).toFixed(0)}% ` +
        "weekly All-Play category win rate",
    });
    featured.add(ranking.team);
  }

  return awards.slice(0, 3);
}

function headline(
  matchups: MatchupResult[],
  rankings: HistoricalRanking[],
  week: number,
): string {
  const decided = matchups.filter((m) => m.winner !== "tie");

  const sweeper = decided.find(
    (m) => Math.max(m.homeCategoryWins, m.awayCategoryWins) === 9,
  );

  if (sweeper) {
    const winner =
      sweeper.winner === "home" ? sweeper.home : sweeper.away;
    return `${winner.toUpperCase()} SWEEPS ALL NINE`;
  }

  const biggestRiser = [...rankings]
    .filter((r) => (r.movement ?? 0) >= 3)
    .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0))[0];

  if (biggestRiser) {
    return `${biggestRiser.team.toUpperCase()} CLIMBS ${
      biggestRiser.movement
    } SPOTS`;
  }

  const biggest = [...decided]
    .sort((a, b) => b.margin - a.margin)[0];

  if (biggest && biggest.margin >= 5) {
    const winner =
      biggest.winner === "home" ? biggest.home : biggest.away;
    return `${winner.toUpperCase()} DELIVERS A STATEMENT WIN`;
  }

  const closest = decided.find((m) => m.margin === 1);

  if (closest) {
    return `ONE CATEGORY SEPARATES ${
      closest.home.toUpperCase()
    } AND ${closest.away.toUpperCase()}`;
  }

  return `WEEK ${week}: THE SCOREBOARD HAS RECEIPTS`;
}

function syntheticBanner(source: DataSource): string[] {
  if (source === "synthetic") {
    return [
      "🔒 *PRIVATE DRAFT — NOT APPROVED*",
      "🧪 DEMO ONLY — Synthetic statistics",
    ];
  }
  return [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "✅ REAL LEAGUE RESULTS — finalized weekly snapshot",
  ];
}

// Short, factual league-wide notes. Ordered most-interesting first so the
// report can include as many as it needs to land in the WhatsApp word band
// without inventing anything.
function byTheNumbers(
  matchups: MatchupResult[],
  ranked: HistoricalRanking[],
): string[] {
  const notes: string[] = [];

  const decided = matchups.filter((m) => m.winner !== "tie");

  const tightest = [...decided].sort((a, b) => a.margin - b.margin)[0];
  if (tightest) {
    const w = tightest.winner === "home" ? tightest.home : tightest.away;
    const l = tightest.winner === "home" ? tightest.away : tightest.home;
    notes.push(
      `• Closest fight: ${w} over ${l} by a ${tightest.margin}-category margin.`,
    );
  }

  const widest = [...decided].sort((a, b) => b.margin - a.margin)[0];
  if (widest && widest !== tightest) {
    const w = widest.winner === "home" ? widest.home : widest.away;
    notes.push(
      `• Widest gap: ${w} won ${Math.max(
        widest.homeCategoryWins,
        widest.awayCategoryWins,
      )} categories in one sitting.`,
    );
  }

  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  if (top && bottom) {
    notes.push(
      `• Power spread: ${top.team} leads at ${(top.powerScore * 100).toFixed(
        0,
      )} while ${bottom.team} anchors the table at ${(
        bottom.powerScore * 100
      ).toFixed(0)}.`,
    );
  }

  const ties = matchups.filter((m) => m.winner === "tie").length;
  const totalTiedCats = matchups.reduce((sum, m) => sum + m.ties, 0);
  if (totalTiedCats > 0) {
    notes.push(
      `• Deadlocks: ${totalTiedCats} categories ended tied across ` +
        `${matchups.length} matchups${ties ? `, including ${ties} split week(s)` : ""}.`,
    );
  }

  return notes;
}

function buildWhatsApp(
  input: WeeklyShowInput,
  matchups: MatchupResult[],
  rankings: HistoricalRanking[],
  awards: Award[],
  storylineText: string[],
  numbersLines: number,
): string {
  const week = input.week;

  const ranked = [...rankings].sort((a, b) => a.powerRank - b.powerRank);

  const widest = [...matchups]
    .filter((m) => m.winner !== "tie")
    .sort((a, b) => b.margin - a.margin)[0];

  const widestWinner = widest
    ? widest.winner === "home" ? widest.home : widest.away
    : "";

  const weekHook = widest
    ? `${widestWinner} delivered the week's widest victory, taking ${
        Math.max(widest.homeCategoryWins, widest.awayCategoryWins)
      } categories`
    : "The matchup scoreboard delivered a week of category deadlocks";

  const opener =
    `${weekHook}. ${ranked[0]!.team} holds the #1 Power Ranking, ` +
    "but that's not simply a head-to-head score. All-Play tests every " +
    "team against all eleven rivals, so winning a matchup doesn't " +
    "guarantee a rise. Six matchups, twelve teams, and enough receipts " +
    "for the group chat. Here's who earned the bragging rights.";

  const closer =
    `The target now sits on ${ranked[0]!.team} at #1, while ` +
    `${ranked[ranked.length - 1]!.team} has a chance to rewrite ` +
    "the story from #12. Another week means another opportunity " +
    "to flip the rankings. Set your lineups, defend your decisions, " +
    "and keep the receipts. 🫡";

  const lines: string[] = [
    ...syntheticBanner(input.source),
    "",
    "🏀 *THE WEEKLY CHAOS REPORT*",
    `*LEAGUE OF EXTRAORDINARY MEN — WEEK ${week}*`,
    `_${headline(matchups, rankings, week)}_`,
    "",
    opener,
    "",
    "⚔️ *THE MATCHUPS*",
  ];

  for (const matchup of matchups) {
    lines.push("• " + recapMatchup(matchup));
  }

  lines.push(
    "",
    input.previousWeeks?.length
      ? "📊 *POWER RANKINGS* (score /100 · movement)"
      : "📊 *POWER RANKINGS* (score /100 · baseline)",
  );

  for (const team of ranked) {
    lines.push(
      `${team.powerRank}. ${team.team} ${movementBadge(team.movement)} ` +
        `(${(team.powerScore * 100).toFixed(0)})`,
    );
  }

  lines.push("", "🏆 *AWARDS*");
  for (const award of awards) {
    lines.push(`${award.title}: ${award.team} — ${award.detail}.`);
  }

  if (storylineText.length > 0) {
    lines.push("", "📰 *STORYLINES*");
    for (const story of storylineText) {
      lines.push(story);
    }
  }

  const numbers = byTheNumbers(matchups, ranked).slice(0, numbersLines);

  if (numbers.length > 0) {
    lines.push("", "🔢 *BY THE NUMBERS*", ...numbers);
  }

  lines.push(
    "",
    closer,
    "",
    input.source === "synthetic"
      ? "DEMO ONLY — Nothing has been sent to WhatsApp."
      : "DRAFT — Nothing has been sent to WhatsApp.",
  );

  return lines.join("\n");
}

function buildAnalytics(
  input: WeeklyShowInput,
  matchups: MatchupResult[],
  rankings: HistoricalRanking[],
  awards: Award[],
): string {
  const ranked = [...rankings].sort((a, b) => a.powerRank - b.powerRank);

  const lines: string[] = [
    ...syntheticBanner(input.source),
    "📈 DETAILED PRIVATE ANALYTICS — internal use only",
    "",
    `LEAGUE OF EXTRAORDINARY MEN — WEEK ${input.week}`,
    `Season ${input.season} | Source: ${input.source}`,
    "",
    "=== MATCHUP BREAKDOWN ===",
  ];

  for (const matchup of matchups) {
    const scoreWinner =
      matchup.winner === "tie"
        ? "TIE"
        : matchup.winner === "home"
          ? matchup.home
          : matchup.away;

    lines.push(
      "",
      `${matchup.home} vs ${matchup.away} — ` +
        `${matchup.homeCategoryWins}-${matchup.awayCategoryWins}` +
        `${matchup.ties ? `-${matchup.ties}` : ""} ` +
        `(${matchup.kind.toUpperCase()}, winner: ${scoreWinner})`,
    );

    for (const category of matchup.categories) {
      const fmt = (v: number) =>
        category.key === "fg_pct" || category.key === "ft_pct"
          ? v.toFixed(3)
          : String(v);
      const mark =
        category.outcome === "home"
          ? `◀ ${matchup.home}`
          : category.outcome === "away"
            ? `${matchup.away} ▶`
            : "TIE";
      lines.push(
        `  ${category.label.padEnd(4)} ${fmt(category.homeValue)} vs ` +
          `${fmt(category.awayValue)} — ${mark}`,
      );
    }
    lines.push("  " + recapMatchup(matchup));
  }

  lines.push("", "=== POWER RANKINGS (performance-based) ===");

  for (const team of ranked) {
    lines.push(
      `${String(team.powerRank).padStart(2)}. ${team.team} ` +
        `| Power ${(team.powerScore * 100).toFixed(1)} ` +
        `| Weekly All-Play #${team.allPlayRank} ` +
        `(${(team.weeklyCategoryWinRate * 100).toFixed(1)}%) ` +
        `| Movement ${movementBadge(team.movement)} ` +
        `| Season cat W-L-T ${team.seasonCategoryWins}-` +
        `${team.seasonCategoryLosses}-${team.seasonCategoryTies}`,
    );
  }

  lines.push("", "=== AWARDS ===");
  for (const award of awards) {
    lines.push(`${award.title}: ${award.team} — ${award.detail}`);
  }

  lines.push(
    "",
    "Power Rankings are derived from season-long and recent All-Play",
    "category win rates via calculateRankingHistory(), not Yahoo standings.",
    "FG% = FGM/FGA and FT% = FTM/FTA; no makes/attempts were inferred.",
    "",
    input.source === "synthetic"
      ? "DEMO ONLY — Nothing has been sent to WhatsApp."
      : "DRAFT — Nothing has been sent to WhatsApp.",
  );

  return lines.join("\n");
}

export function generateWeeklyShow(input: WeeklyShowInput): WeeklyShow {
  if (input.teams.length !== 12) {
    throw new Error("Weekly Show requires exactly 12 teams");
  }

  const previous = input.previousWeeks ?? [];

  for (const snapshot of previous) {
    if (snapshot.week >= input.week) {
      throw new Error(
        `Previous week ${snapshot.week} must come before week ${input.week}`,
      );
    }
  }

  const weeks: WeeklySnapshot[] = [
    ...previous,
    { week: input.week, teams: input.teams },
  ];

  const history = calculateRankingHistory(weeks);
  const latest = history.at(-1)!;
  const rankings = latest.rankings;

  const matchups = buildMatchups(input.teams, input.pairings);
  const awards = buildAwards(matchups, rankings);

  const storylineText = detectStorylines(latest)
    .slice(0, 2)
    .map((story) => formatStoryline(story, input.style ?? "playful"));

  // Include as many factual "by the numbers" notes as needed to reach the
  // WhatsApp word band, capped at the four available notes.
  let whatsapp = "";
  let wordCount = 0;

  for (let numbersLines = 0; numbersLines <= 4; numbersLines++) {
    whatsapp = buildWhatsApp(
      input,
      matchups,
      rankings,
      awards,
      storylineText,
      numbersLines,
    );
    wordCount = countWords(whatsapp);
    if (wordCount >= WHATSAPP_MIN_WORDS) break;
  }

  const analytics = buildAnalytics(input, matchups, rankings, awards);

  if (wordCount < WHATSAPP_MIN_WORDS || wordCount > WHATSAPP_MAX_WORDS) {
    throw new Error(
      `WhatsApp report is ${wordCount} words; expected ` +
        `${WHATSAPP_MIN_WORDS}-${WHATSAPP_MAX_WORDS}`,
    );
  }

  return {
    status: "draft",
    source: input.source,
    week: input.week,
    matchups,
    rankings,
    whatsapp,
    analytics,
    wordCount,
  };
}
