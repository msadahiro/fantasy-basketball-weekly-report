import { readFileSync } from "node:fs";
import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";
import { loadOfficialStandings } from "./officialYahoo.js";

const [csvPath, standingsPath] = process.argv.slice(2);

if (!csvPath || !standingsPath) {
  throw new Error(
    "Usage: npx tsx src/compareHistoricalYahoo.ts " +
    "<totals.csv> <standings.json>",
  );
}

const standings = loadOfficialStandings(standingsPath);

const displayed = parseYahooMatchupCsv(
  readFileSync(csvPath, "utf8"),
  standings.season,
  1,
);

const allPlay = calculateDisplayedAllPlay(displayed);
const byId = new Map(
  allPlay.rankings.map((team) => [team.id, team]),
);

console.log("\nYAHOO FINAL PLACEMENT vs SEASON-TOTAL ALL-PLAY");
console.log("==============================================");
console.log("Yahoo placement | All-Play rank | Team | W-L-T");
console.log("");

for (const team of [...standings.teams].sort(
  (a, b) => a.placement - b.placement,
)) {
  const calculated = byId.get(team.id);

  if (!calculated) {
    throw new Error(`Unmatched team: ${team.name}`);
  }

  if (calculated.name !== team.name) {
    throw new Error(
      `Team ID/name mismatch: ${team.id}`,
    );
  }

  console.log(
    `${String(team.placement).padStart(2)} | ` +
    `${String(calculated.rank).padStart(2)} | ` +
    `${team.name} | ` +
    `${team.wins}-${team.losses}-${team.ties}`,
  );
}

console.log(
  "\nYahoo placement reflects the final standings shown."
);
console.log(
  "W-L-T reflects the regular-season category record."
);
console.log(
  "All-Play is a provisional comparison of season totals."
);
console.log(
  "It does not reconstruct weekly rankings or playoff outcomes."
);
