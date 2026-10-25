import { readFileSync } from "node:fs";
import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";

const filepath = process.argv[2];

if (!filepath) {
  throw new Error(
    "Usage: npx tsx src/previewHistoricalSeason.ts <csv-file>",
  );
}

// Season/week are parser metadata only. The input itself
// contains season totals, not a single week's statistics.
const input = parseYahooMatchupCsv(
  readFileSync(filepath, "utf8"),
  2025,
  1,
);

const result = calculateDisplayedAllPlay(input);

console.log("\n🏀 HISTORICAL SEASON-TOTAL ALL-PLAY");
console.log("===================================");
console.log("12 teams | 9 categories | 99 comparisons per team");
console.log("Rounded Yahoo shooting percentages: provisional\n");

for (const team of result.rankings) {
  const range =
    team.uncertain > 0
      ? ` [${team.minimum.toFixed(1)}-${team.maximum.toFixed(1)}]`
      : "";

  console.log(
    `${String(team.rank).padStart(2)}. ${team.name}` +
    ` | ${team.midpoint.toFixed(1)}/100${range}` +
    ` | ${team.wins}W-${team.losses}L-${team.ties}T` +
    ` | ${team.uncertain} uncertain`,
  );
}

console.log(
  "\nHistorical comparison only; not weekly Power Rankings."
);
console.log(
  "These totals may reflect different games played per team."
);
console.log(
  "Overlapping score ranges mean exact positions may be uncertain."
);
