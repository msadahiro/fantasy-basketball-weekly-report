import { readFile } from "node:fs/promises";

import {
  createProvisionalMatchupReport,
  saveProvisionalMatchupReport,
} from "../reports/matchupReport.js";

import type { WriterStyle } from "../editorial/sportswriter.js";

const [filepath, weekArgument, styleArgument = "playful", saveArgument] =
  process.argv.slice(2);

if (
  !filepath ||
  !/^[1-9]\d*$/.test(weekArgument ?? "") ||
  !["professional", "playful", "roast"].includes(styleArgument) ||
  (saveArgument !== undefined && saveArgument !== "--save")
) {
  throw new Error(
    "Usage: npx tsx src/cli/previewMatchup.ts " +
      "<csv-file> WEEK [professional|playful|roast] [--save]",
  );
}

const week = Number(weekArgument);
const csv = await readFile(filepath, "utf8");

const report = createProvisionalMatchupReport(
  csv,
  week,
  styleArgument as WriterStyle,
);

console.log("\n" + report + "\n");

if (saveArgument === "--save") {
  const saved = await saveProvisionalMatchupReport(report, week);

  console.log(`Private draft saved: ${saved}`);
  console.log("Nothing sent or published.");
}
