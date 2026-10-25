import { readFileSync } from "node:fs";

import type { TeamStats } from "./allPlay.js";
import type { WeeklySnapshot } from "./powerRankings.js";
import { loadWeeklyData, parseWeeklyData } from "./weeklyData.js";
import { loadMatchupPairings } from "./matchupPairings.js";
import { generateWeeklyShow } from "./weeklyShow.js";
import { saveWeeklyShow } from "./weeklyShowSave.js";
import type { WriterStyle } from "./sportswriter.js";

function usage(): never {
  throw new Error(
    "Usage: npx tsx src/generateWeeklyShow.ts <week.json> <pairings.json> " +
      "[--source synthetic|real] [--style professional|playful|roast] " +
      "[--previous w1.json,w2.json] [--save]",
  );
}

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const [weekPath, pairingsPath] = process.argv.slice(2);

if (!weekPath || weekPath.startsWith("--") || !pairingsPath) {
  usage();
}

const source = (parseFlag("--source") ?? "synthetic") as "synthetic" | "real";

if (source !== "synthetic" && source !== "real") {
  usage();
}

const style = (parseFlag("--style") ?? "playful") as WriterStyle;

const previousArg = parseFlag("--previous");

const previousWeeks: WeeklySnapshot[] = previousArg
  ? previousArg.split(",").map((file) => {
      const data = loadWeeklyData(file.trim());
      return { week: data.week, teams: data.teams as TeamStats[] };
    })
  : [];

// Real reports require a finalized, schema-validated snapshot. Synthetic demo
// fixtures are validated with the same schema so demonstrations stay honest.
const week = parseWeeklyData(
  JSON.parse(readFileSync(weekPath!, "utf8")) as unknown,
);

const pairings = loadMatchupPairings(pairingsPath!);

const show = generateWeeklyShow({
  season: week.season,
  week: week.week,
  teams: week.teams as TeamStats[],
  pairings,
  previousWeeks,
  source,
  style,
});

console.log("\n================ WHATSAPP REPORT ================\n");
console.log(show.whatsapp);
console.log(`\n(${show.wordCount} words)`);
console.log("\n================================================\n");

if (process.argv.includes("--save")) {
  const saved = await saveWeeklyShow(show);
  console.log(`WhatsApp draft saved: ${saved.whatsappPath}`);
  console.log(`Analytics draft saved: ${saved.analyticsPath}`);
  console.log("Nothing has been sent or published.");
} else {
  console.log("Not saved. Pass --save to write a private draft.");
}
