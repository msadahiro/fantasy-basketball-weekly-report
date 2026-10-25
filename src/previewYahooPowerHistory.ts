import { readFileSync } from "node:fs";

import { parseYahooMatchupCsv } from "./yahooMatchupCsv.js";
import { calculateYahooRankingHistory } from "./yahooPowerRankings.js";

const [seasonRaw, ...fileSpecs] = process.argv.slice(2);

if (
  !seasonRaw ||
  !/^[1-9]\d*$/.test(seasonRaw) ||
  fileSpecs.length === 0
) {
  throw new Error(
    "Usage: npx tsx src/previewYahooPowerHistory.ts " +
    "<season> 1:<week1.csv> 2:<week2.csv> ...",
  );
}

const season = Number(seasonRaw);

if (!Number.isSafeInteger(season)) {
  throw new Error("Invalid season");
}

const weeks = fileSpecs.map((spec) => {
  const match = /^([1-9]\d*):(.+)$/.exec(spec);

  if (!match) {
    throw new Error(`Invalid week:file argument: ${spec}`);
  }

  const week = Number(match[1]);
  const filepath = match[2]!;

  if (!Number.isSafeInteger(week)) {
    throw new Error(`Invalid week: ${match[1]}`);
  }

  return parseYahooMatchupCsv(
    readFileSync(filepath, "utf8"),
    season,
    week,
  );
});

const history = calculateYahooRankingHistory(weeks);
const latest = history.at(-1)!;

console.log("\n🏀 PROVISIONAL YAHOO POWER RANKINGS");
console.log(`Season ${latest.season} | Week ${latest.week}`);
console.log("60% season All-Play + 40% weighted recent All-Play");
console.log("Rounded shooting percentages; positions are provisional.\n");

for (const team of latest.rankings) {
  const movement =
    team.movement === null
      ? "NEW"
      : team.movement > 0
        ? `UP ${team.movement}`
        : team.movement < 0
          ? `DOWN ${Math.abs(team.movement)}`
          : "SAME";

  const range =
    team.seasonUncertain > 0
      ? ` [${(team.minimumPowerScore * 100).toFixed(1)}-${(
          team.maximumPowerScore * 100
        ).toFixed(1)}]`
      : "";

  console.log(
    `${String(team.rank).padStart(2)}. ${team.team}` +
    ` | ${(team.powerScore * 100).toFixed(1)}/100${range}` +
    ` | ${movement}` +
    ` | Weekly All-Play #${team.latestAllPlayRank}`,
  );
}

console.log(
  "\nPower Scores are provisional. No draft saved or published.",
);
