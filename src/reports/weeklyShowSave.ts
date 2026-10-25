import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WeeklyShow } from "./weeklyShow.js";

const DEFAULT_REPORT_DIR = "data/private/reports";

export interface SavedWeeklyShow {
  whatsappPath: string;
  analyticsPath: string;
}

function assertValid(show: WeeklyShow): void {
  if (
    show.status !== "draft" ||
    !show.whatsapp.includes("PRIVATE DRAFT") ||
    !show.analytics.includes("PRIVATE DRAFT")
  ) {
    throw new Error("Invalid Weekly Show draft");
  }
}

export async function saveWeeklyShow(
  show: WeeklyShow,
  directory = DEFAULT_REPORT_DIR,
): Promise<SavedWeeklyShow> {
  if (!Number.isSafeInteger(show.week) || show.week < 1) {
    throw new Error("Invalid report week");
  }

  assertValid(show);

  await mkdir(directory, { recursive: true, mode: 0o700 });

  const prefix = show.source === "synthetic" ? "demo" : "week";

  const whatsappPath = path.join(
    directory,
    `${prefix}-weekly-show-week-${show.week}.txt`,
  );

  const analyticsPath = path.join(
    directory,
    `${prefix}-weekly-show-week-${show.week}.analytics.txt`,
  );

  // "wx" creates a new file only; never silently overwrite an existing draft.
  await writeFile(whatsappPath, show.whatsapp, { flag: "wx", mode: 0o600 });
  await writeFile(analyticsPath, show.analytics, { flag: "wx", mode: 0o600 });

  return { whatsappPath, analyticsPath };
}
