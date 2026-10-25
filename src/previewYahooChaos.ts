import { readFileSync } from "node:fs";

import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";
import { loadMatchupPairings } from "./matchupPairings.js";
import { countWords } from "./weeklyShow.js";
import { saveYahooChaosDraft } from "./yahooChaosSave.js";
import { calculateYahooRankingHistory } from "./yahooPowerRankings.js";
import { assertWhatsAppEditorial } from "./yahooChaosEditorial.js";
import { loadApprovedYahooStoryHistory } from "./yahooStoryHistory.js";
import { loadPublishedYahooStoryHistory } from "./publishedYahooStoryHistory.js";
import { buildYahooStoryCallback } from "./yahooStoryContinuity.js";

const [csvPath, pairingsPath, source, ...options] = process.argv.slice(2);

let save = false;
let saveRevision = false;
let previousPaths: string[] | null = null;

for (let i = 0; i < options.length; i++) {
  if (options[i] === "--save") {
    if (save || saveRevision) {
      throw new Error("Choose one save mode");
    }
    save = true;
  } else if (options[i] === "--save-revision") {
    if (save || saveRevision) {
      throw new Error("Choose one save mode");
    }
    saveRevision = true;
  } else if (options[i] === "--previous") {
    if (previousPaths !== null) {
      throw new Error("Duplicate --previous");
    }

    const value = options[++i];
    if (!value || value.startsWith("--")) {
      throw new Error("--previous requires comma-separated CSV paths");
    }

    previousPaths = value.split(",");
    if (previousPaths.some((filepath) => !filepath)) {
      throw new Error("Empty previous-week CSV path");
    }
  } else {
    throw new Error(`Unknown option: ${options[i]}`);
  }
}

if (
  !csvPath ||
  !pairingsPath ||
  (source !== "synthetic" && source !== "real")
) {
  throw new Error(
    "Usage: npx tsx src/previewYahooChaos.ts " +
    "<yahoo.csv> <pairings.json> synthetic|real " +
    "[--previous w1.csv,w2.csv] [--save|--save-revision]"
  );
}

const pairings = loadMatchupPairings(pairingsPath);

const week = parseYahooMatchupCsv(
  readFileSync(csvPath, "utf8"),
  pairings.season,
  pairings.week,
);

const result = calculateDisplayedAllPlay(week, pairings);

const previousFiles = previousPaths ?? [];

if (previousFiles.length !== week.week - 1) {
  throw new Error(
    `Week ${week.week} requires ${week.week - 1} previous CSV files ` +
    "for accurate Power Rankings.",
  );
}

const powerHistory = calculateYahooRankingHistory([
  ...previousFiles.map((filepath, index) =>
    parseYahooMatchupCsv(
      readFileSync(filepath, "utf8"),
      week.season,
      index + 1,
    )
  ),
  week,
]);

const power = powerHistory.at(-1)!;

const approvedStories = source === "synthetic"
  ? await loadApprovedYahooStoryHistory({
      season: week.season,
      beforeWeek: week.week,
      source,
    })
  : await loadPublishedYahooStoryHistory({
      leagueId: "league-of-extraordinary-men",
      season: week.season,
      beforeWeek: week.week,
    });

const continuity = buildYahooStoryCallback(
  approvedStories,
  powerHistory.at(-2)?.rankings ?? null,
  power.rankings,
  week.week,
);

const byId = new Map(
  week.teams.map((team) => [team.id, team]),
);

const categories = [
  { key: "fg_pct", label: "FG%", joke: "The rim had a favorite." },
  { key: "ft_pct", label: "FT%", joke: "The charity stripe chose sides." },
  { key: "threes", label: "3PM", joke: "Long-range receipts delivered." },
  { key: "points", label: "PTS", joke: "The scoreboard did the talking." },
  { key: "rebounds", label: "REB", joke: "Glass-cleaning service included." },
  { key: "assists", label: "AST", joke: "Sharing apparently is caring." },
  { key: "steals", label: "STL", joke: "Check the lost-and-found." },
  { key: "blocks", label: "BLK", joke: "Entry to the paint denied." },
  { key: "turnovers", label: "TO", joke: "Ball security wins friends." },
] as const;

function leaderName(
  matchup: (typeof result.matchups)[number],
): string | null {
  if (matchup.homeWins === matchup.awayWins) return null;

  return matchup.homeWins > matchup.awayWins
    ? matchup.home
    : matchup.away;
}

function recap(
  matchup: (typeof result.matchups)[number],
  index: number,
): string {
  const [homeId, awayId] = pairings.pairings[index]!;
  const home = byId.get(homeId)!;
  const away = byId.get(awayId)!;

  const leaderHome = matchup.homeWins > matchup.awayWins;
  const leaderAway = matchup.awayWins > matchup.homeWins;
  const leader = leaderName(matchup);

  const score =
    `${matchup.homeWins}-${matchup.awayWins}` +
    (matchup.ties ? `-${matchup.ties}` : "");

  const uncertainty = matchup.uncertain
    ? ` (${matchup.uncertain} unresolved)`
    : "";

  const winningStats = categories.filter((category) => {
    const a = home[category.key];
    const b = away[category.key];

    if (a === b) return false;

    const homeBetter =
      category.key === "turnovers" ? a < b : a > b;

    return (
      (leaderHome && homeBetter) ||
      (leaderAway && !homeBetter)
    );
  });

  const featured = winningStats.length
    ? winningStats[index % winningStats.length]
    : undefined;

  const detail = featured
    ? `${featured.label} ${featured.key.endsWith("_pct")
        ? home[featured.key].toFixed(3)
        : home[featured.key]}-${featured.key.endsWith("_pct")
        ? away[featured.key].toFixed(3)
        : away[featured.key]}. ${featured.joke}`
    : "The category scoreboard is evenly split.";

  const outcome = leader
    ? `The category edge goes to ${leader}.`
    : "Neither side has a category lead.";

  return (
    `• ${matchup.home} ${score}${uncertainty} ${matchup.away}. ` +
    `${outcome} ${detail}`
  );
}

const ordered = [...result.rankings];

const decided = [...result.matchups].filter(
  (matchup) => matchup.homeWins !== matchup.awayWins,
);

const byMargin = [...decided].sort(
  (a, b) =>
    Math.abs(b.homeWins - b.awayWins) -
    Math.abs(a.homeWins - a.awayWins),
);

const biggest = byMargin[0];
const closest = byMargin.at(-1);

const biggestLeader = biggest ? leaderName(biggest) : null;
const closestLeader = closest ? leaderName(closest) : null;

const bottom = ordered.at(-1)!;

const rankings = power.rankings.map((team) => {
  const movement = team.movement === null
    ? "NEW"
    : team.movement > 0
      ? `⬆️${team.movement}`
      : team.movement < 0
        ? `⬇️${Math.abs(team.movement)}`
        : "➖";

  return (
    `${team.rank}. ${team.team} ${movement} — ` +
    `${(team.powerScore * 100).toFixed(1)}/100`
  );
});

const awards: string[] = [];

if (biggest && biggestLeader) {
  awards.push(
    `🧹 *Steamroller:* ${biggestLeader} — ` +
    `${Math.max(biggest.homeWins, biggest.awayWins)} ` +
    "category leads in the widest matchup."
  );
}

if (
  closest &&
  closestLeader &&
  closestLeader !== biggestLeader
) {
  awards.push(
    `🎩 *Escape Artist:* ${closestLeader} — ` +
    `${Math.max(closest.homeWins, closest.awayWins)}-` +
    `${Math.min(closest.homeWins, closest.awayWins)} ` +
    "in the closest decided matchup."
  );
}

awards.push(
  `🧊 *Rough Week:* ${bottom.name} — ` +
  `a difficult week across the box score.`
);

const riser = power?.rankings
  .filter((team) => (team.movement ?? 0) > 0)
  .sort((a, b) => b.movement! - a.movement!)[0];

const faller = power?.rankings
  .filter((team) => (team.movement ?? 0) < 0)
  .sort((a, b) => a.movement! - b.movement!)[0];

const movementStories = [
  riser
    ? `🚀 *The Climb:* ${riser.team} rose ${riser.movement} spots to #${riser.rank}.`
    : null,
  faller
    ? `📉 *The Freefall:* ${faller.team} dropped ${Math.abs(faller.movement!)} spots to #${faller.rank}.`
    : null,
].filter((line): line is string => line !== null);

const lines = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  source === "synthetic"
    ? "🧪 DEMO ONLY — Synthetic statistics"
    : "⚠️ MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
  "",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  `*LEAGUE OF EXTRAORDINARY MEN — WEEK ${week.week}*`,
  biggestLeader
    ? `_${biggestLeader.toUpperCase()} IN THE SPOTLIGHT_`
    : "_THE LEAGUE REFUSES TO PICK A SIDE_",
  "",
  `Six matchups, twelve teams, and a week of chaos. ` +
  `The Power Rankings reflect sustained results and recent momentum. ` +
  `Here are the biggest wins, surprises, and receipts.`,
  "",
  "⚔️ *MATCHUP MADNESS*",
  ...result.matchups.map(recap),
  "",
  "📊 *PROVISIONAL POWER RANKINGS*",
  "_Power Score /100 · movement from last week_",
  ...rankings,
  "",
  "🏆 *THE CHAOS AWARDS*",
  ...awards,
  "",
  "📰 *THE BIG PICTURE*",
  continuity ??
    (`The #1 Power Ranking belongs to ${power.rankings[0]!.team} at ` +
    `${(power.rankings[0]!.powerScore * 100).toFixed(1)}/100, ` +
    `while ${power.rankings.at(-1)!.team} faces the climb from #12. ` +
    `The rest of the league has work to do. ` +
    `Some teams are building momentum, while others are running ` +
    `out of explanations. Every week brings new pressure.`),
  ...movementStories,
  "",
  "🔮 *NEXT WEEK'S DRAMA*",
  `Can ${power.rankings[0]!.team} defend the #1 ranking? ` +
  `Can ${bottom.name} answer the critics? ` +
  "One strong week can change the conversation. " +
  "Set those lineups, check the box scores, and keep the receipts. 🫡",
  "",
  "⚠️ Power Rankings are provisional until Yahoo data is fully verified.",
  source === "synthetic"
    ? "DEMO ONLY — Nothing sent to WhatsApp."
    : "PROVISIONAL — Not approved or sent to WhatsApp.",
];

const report = lines.join("\n");
assertWhatsAppEditorial(report);
const words = countWords(report);

console.log("\n========== YAHOO CHAOS PREVIEW ==========\n");
console.log(report);
console.log(`\n(${words} words)`);
console.log("\n=========================================");
if (save || saveRevision) {
  const filepath = await saveYahooChaosDraft(
    report,
    week.season,
    week.week,
    source,
    "data/private/reports",
    saveRevision,
  );

  console.log(`Saved private draft: ${filepath}`);
  console.log(
    `Review with: npx tsx src/reviewWeeklyShow.ts ${filepath}`
  );
  console.log("Not approved or published.");
} else {
  console.log("Not saved. Pass --save to create a private draft.");
}
