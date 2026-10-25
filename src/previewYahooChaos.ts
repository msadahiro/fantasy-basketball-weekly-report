import { readFileSync } from "node:fs";

import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";
import { loadMatchupPairings } from "./matchupPairings.js";
import { countWords } from "./weeklyShow.js";
import { saveYahooChaosDraft } from "./yahooChaosSave.js";

const [csvPath, pairingsPath, source, ...options] = process.argv.slice(2);
const save = options.length === 1 && options[0] === "--save";

if (
  !csvPath ||
  !pairingsPath ||
  (source !== "synthetic" && source !== "real") ||
  (options.length > 0 && !save)
) {
  throw new Error(
    "Usage: npx tsx src/previewYahooChaos.ts " +
    "<yahoo.csv> <pairings.json> synthetic|real [--save]"
  );
}

const pairings = loadMatchupPairings(pairingsPath);

const week = parseYahooMatchupCsv(
  readFileSync(csvPath, "utf8"),
  pairings.season,
  pairings.week,
);

const result = calculateDisplayedAllPlay(week, pairings);

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
    ? `${leader} holds the category lead.`
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

const top = ordered[0]!;
const bottom = ordered.at(-1)!;

const rankings = ordered.map((team) => {
  const range = team.uncertain
    ? ` [${team.minimum.toFixed(1)}-${team.maximum.toFixed(1)}]`
    : "";

  return (
    `${team.rank}. ${team.name} — ` +
    `${team.midpoint.toFixed(1)}/100${range}`
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
  `${bottom.midpoint.toFixed(1)}/100 in weekly All-Play.`
);

const lines = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  source === "synthetic"
    ? "🧪 DEMO ONLY — Synthetic statistics"
    : "⚠️ MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
  "",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  `*LEAGUE OF EXTRAORDINARY MEN — WEEK ${week.week}*`,
  biggestLeader
    ? `_${biggestLeader.toUpperCase()} MAKES A STATEMENT_`
    : "_THE LEAGUE REFUSES TO PICK A SIDE_",
  "",
  `Six matchups, twelve teams, and another week of fantasy chaos. ` +
  `${biggestLeader ?? "The league"} produced the widest category ` +
  `margin, while ${top.name} leads the weekly All-Play table. ` +
  "Those aren't necessarily the same achievement. " +
  "All-Play compares every team against all eleven rivals, " +
  "so a favorable matchup alone won't fool the numbers. " +
  "Here are the receipts.",
  "",
  "⚔️ *MATCHUP MADNESS*",
  ...result.matchups.map(recap),
  "",
  "📊 *PROVISIONAL WEEKLY ALL-PLAY*",
  "_Category score /100 · Not multiweek Power Rankings_",
  ...rankings,
  "",
  "🏆 *THE CHAOS AWARDS*",
  ...awards,
  "",
  "📰 *THE BIG PICTURE*",
  `${top.name} sets the full-field pace at ` +
  `${top.midpoint.toFixed(1)}/100, while ${bottom.name} ` +
  `finishes this snapshot at ${bottom.midpoint.toFixed(1)}/100. ` +
  "These scores measure this week's production, not " +
  "roster potential or playoff positioning.",
  "",
  "🔮 *NEXT WEEK'S DRAMA*",
  `Can ${top.name} repeat that performance? ` +
  `Can ${bottom.name} answer the critics? ` +
  "One strong week can change the conversation. " +
  "Set those lineups, check the box scores, and keep the receipts. 🫡",
  "",
  "⚠️ Rounded FG%/FT%; equal displayed values may be unresolved.",
  source === "synthetic"
    ? "DEMO ONLY — Nothing sent to WhatsApp."
    : "PROVISIONAL — Not approved or sent to WhatsApp.",
];

const report = lines.join("\n");
const words = countWords(report);

console.log("\n========== YAHOO CHAOS PREVIEW ==========\n");
console.log(report);
console.log(`\n(${words} words)`);
console.log("\n=========================================");
if (save) {
  const filepath = await saveYahooChaosDraft(
    report,
    week.season,
    week.week,
    source,
  );

  console.log(`Saved private draft: ${filepath}`);
  console.log(
    `Review with: npx tsx src/reviewWeeklyShow.ts ${filepath}`
  );
  console.log("Not approved or published.");
} else {
  console.log("Not saved. Pass --save to create a private draft.");
}
