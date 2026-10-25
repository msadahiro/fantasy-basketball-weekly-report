import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCsvTemplate, convertManualCsv } from "./manualCsv.js";

const [command, seasonArg, weekArg, confirmation] = process.argv.slice(2);

if (!/^[1-9]\d*$/.test(seasonArg ?? "") || !/^[1-9]\d*$/.test(weekArg ?? "")) {
  throw new Error(
    "Usage: npx tsx src/csvWeek.ts <template|convert> SEASON WEEK [--finalized]",
  );
}

const season = Number(seasonArg);
const week = Number(weekArg);

if (!Number.isSafeInteger(season) || !Number.isSafeInteger(week)) {
  throw new Error("Invalid season or week");
}

const directory = "data/private/weeks";

const csvFile = path.join(directory, `${season}-week-${week}.csv`);

const jsonFile = path.join(directory, `${season}-week-${week}-manual.json`);

switch (command) {
  case "template": {
    await mkdir(directory, {
      recursive: true,
      mode: 0o700,
    });

    await writeFile(csvFile, createCsvTemplate(), {
      flag: "wx",
      mode: 0o600,
    });

    console.log(`Created private template: ${csvFile}`);
    break;
  }

  case "convert": {
    if (confirmation !== "--finalized") {
      throw new Error(
        "Confirm weekly statistics are finalized using --finalized",
      );
    }

    const csv = await readFile(csvFile, "utf8");
    const data = convertManualCsv(csv, season, week);

    await writeFile(jsonFile, JSON.stringify(data, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });

    console.log(`Validated private JSON: ${jsonFile}`);
    console.log("Source: manually entered, not independently verified.");
    break;
  }

  default:
    throw new Error(`Unknown command: ${command}`);
}
