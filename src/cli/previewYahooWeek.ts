import { readFileSync } from "node:fs";

import { parseYahooMatchupCsv } from "../yahoo/yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "../rankings/yahooDisplayedAllPlay.js";
import { loadMatchupPairings } from "../data/matchupPairings.js";

const [csvPath, pairingsPath] = process.argv.slice(2);

if (!csvPath || !pairingsPath) {
  throw new Error(
    "Usage: npx tsx src/cli/previewYahooWeek.ts " +
    "<yahoo.csv> <pairings.json>",
  );
}

const pairings = loadMatchupPairings(pairingsPath);

const week = parseYahooMatchupCsv(
  readFileSync(csvPath, "utf8"),
  pairings.season,
  pairings.week,
);

const result = calculateDisplayedAllPlay(week, pairings);

console.log("\n🏀 PROVISIONAL YAHOO ALL-PLAY");
console.log(`Season ${result.season} | Week ${result.week}`);
console.log("12 teams | 99 comparisons per team");
console.log("Rounded shooting percentages; not official rankings.\n");

console.log("📊 ALL-PLAY LEADERBOARD\n");

for (const team of result.rankings) {
  const range = team.uncertain
    ? ` [${team.minimum.toFixed(1)}-${team.maximum.toFixed(1)}]`
    : "";

  console.log(
    `${String(team.rank).padStart(2)}. ${team.name} ` +
    `| ${team.midpoint.toFixed(1)}/100${range}` +
    ` | ${team.wins}W ${team.losses}L` +
    ` ${team.ties}T ${team.uncertain} uncertain`,
  );
}

console.log("\n⚔️ SIX MATCHUPS\n");

for (const matchup of result.matchups) {
  console.log(
    `${matchup.home} vs ${matchup.away}: ` +
    `${matchup.homeWins}-${matchup.awayWins}-${matchup.ties}` +
    (matchup.uncertain
      ? ` (${matchup.uncertain} uncertain)`
      : ""),
  );
}

console.log(
  "\nProvisional preview only. No draft saved or sent."
);
