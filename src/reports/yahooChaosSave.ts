import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { countWords } from "./weeklyShow.js";

export type YahooChaosSource = "synthetic" | "real";

export async function saveYahooChaosDraft(
  report: string,
  season: number,
  week: number,
  source: YahooChaosSource,
  directory = "data/private/reports",
  allowRevision = false,
): Promise<string> {
  if (
    !Number.isSafeInteger(season) ||
    season < 1 ||
    !Number.isSafeInteger(week) ||
    week < 1
  ) {
    throw new Error("Invalid Yahoo report season or week");
  }

  if (
    !report.includes("PRIVATE DRAFT") ||
    !report.includes("THE WEEKLY CHAOS REPORT")
  ) {
    throw new Error("Not an eligible private Yahoo draft");
  }

  if (source === "synthetic") {
    if (
      !report.includes("DEMO ONLY") ||
      report.includes("MANUAL YAHOO DATA")
    ) {
      throw new Error("Synthetic Yahoo report must be labeled DEMO ONLY");
    }
  } else {
    if (
      !report.includes("MANUAL YAHOO DATA") ||
      !report.includes(
        "PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED"
      ) ||
      (!report.includes("PROVISIONAL WEEKLY ALL-PLAY") &&
        !report.includes("PROVISIONAL POWER RANKINGS")) ||
      report.includes("DEMO ONLY")
    ) {
      throw new Error("Real Yahoo report requires provisional Yahoo markers");
    }
  }

  const words = countWords(report);

  if (words < 350 || words > 450) {
    throw new Error(
      `Yahoo report must be 350-450 words; received ${words}`,
    );
  }

  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  const hasPowerRankings = report.includes(
    "PROVISIONAL POWER RANKINGS",
  );

  const prefix = source === "synthetic"
    ? hasPowerRankings
      ? "demo-yahoo-power-chaos"
      : "demo-yahoo-chaos"
    : hasPowerRankings
      ? "yahoo-provisional-power-chaos"
      : "yahoo-provisional-chaos";

  const basename = `${prefix}-season-${season}-week-${week}`;
  let revision = 1;

  while (true) {
    const suffix = revision === 1 ? "" : `-v${revision}`;
    const filepath = path.join(directory, `${basename}${suffix}.txt`);

    try {
      await writeFile(filepath, report, {
        flag: "wx",
        mode: 0o600,
      });
      return filepath;
    } catch (error) {
      if (
        !allowRevision ||
        (error as NodeJS.ErrnoException).code !== "EEXIST"
      ) {
        throw error;
      }
      revision++;
    }
  }
}
