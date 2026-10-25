import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  getDraftApprovalStatus,
  hashDraft,
} from "./draftApproval.js";
import { assertWhatsAppEditorial } from "./yahooChaosEditorial.js";
import type { YahooChaosSource } from "./yahooChaosSave.js";

export interface ApprovedYahooStory {
  season: number;
  week: number;
  source: YahooChaosSource;
  filepath: string;
  sha256: string;
  headline: string | null;
  rankings: string[];
  awards: string[];
  storylines: string[];
  nextWeekTeaser: string | null;
  article: string;
}

export interface StoryHistoryRequest {
  season: number;
  beforeWeek: number;
  source: YahooChaosSource;
  directory?: string;
}

function sectionLines(
  article: string,
  heading: string,
): string[] {
  const lines = article.split(/\r?\n/);
  const index = lines.findIndex(
    (line) => line.trim() === heading,
  );

  if (index < 0) return [];

  const result: string[] = [];

  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) break;
    result.push(line);
  }

  return result;
}

function readStory(
  article: string,
  filepath: string,
  season: number,
  week: number,
  source: YahooChaosSource,
  published = false,
): ApprovedYahooStory {
  if (!published && !article.includes("PRIVATE DRAFT")) {
    throw new Error(`Invalid approved report: ${filepath}`);
  }

  const correctSource = published
    ? source === "real" &&
      article.startsWith("🏀 *THE WEEKLY CHAOS REPORT*") &&
      !article.includes("PRIVATE DRAFT") &&
      !article.includes("DEMO ONLY")
    : source === "synthetic"
      ? article.includes("DEMO ONLY") &&
        !article.includes("MANUAL YAHOO DATA")
      : article.includes(
          "PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
        ) && !article.includes("DEMO ONLY");

  if (!correctSource) {
    throw new Error(`Report source mismatch: ${filepath}`);
  }

  assertWhatsAppEditorial(article);

  const weekHeader = article.match(
    /^\*.*\bWEEK ([1-9]\d*)\*$/m,
  );

  if (!weekHeader || Number(weekHeader[1]) !== week) {
    throw new Error(`Report week mismatch: ${filepath}`);
  }

  const headline = article.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^_[^_]+_$/.test(line));

  const rankings = sectionLines(
    article,
    "📊 *PROVISIONAL POWER RANKINGS*",
  ).filter((line) => /^\d+\.\s/.test(line));

  if (rankings.length !== 12) {
    throw new Error(
      `Approved report does not contain 12 rankings: ${filepath}`,
    );
  }

  return {
    season,
    week,
    source,
    filepath,
    sha256: hashDraft(article),
    headline: headline ? headline.slice(1, -1) : null,
    rankings,
    awards: sectionLines(
      article,
      "🏆 *THE CHAOS AWARDS*",
    ),
    storylines: sectionLines(
      article,
      "📰 *THE BIG PICTURE*",
    ),
    nextWeekTeaser: sectionLines(
      article,
      "🔮 *NEXT WEEK'S DRAMA*",
    )[0] ?? null,
    article,
  };
}

export function parseSharedYahooStory(
  article: string,
  draftPath: string,
  season: number,
  week: number,
): ApprovedYahooStory {
  return readStory(
    article,
    draftPath,
    season,
    week,
    "real",
    true,
  );
}

export async function loadApprovedYahooStoryHistory(
  request: StoryHistoryRequest,
): Promise<ApprovedYahooStory[]> {
  const {
    season,
    beforeWeek,
    source,
    directory = "data/private/reports",
  } = request;

  if (
    !Number.isSafeInteger(season) ||
    season < 1 ||
    !Number.isSafeInteger(beforeWeek) ||
    beforeWeek < 1 ||
    (source !== "synthetic" && source !== "real")
  ) {
    throw new Error("Invalid story history request");
  }

  let filenames: string[];

  try {
    filenames = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const pattern =
    /^(demo-yahoo-power-chaos|yahoo-provisional-power-chaos)-season-([1-9]\d*)-week-([1-9]\d*)(?:-v([1-9]\d*))?\.txt$/;

  const requiredPrefix = source === "synthetic"
    ? "demo-yahoo-power-chaos"
    : "yahoo-provisional-power-chaos";

  const matching = filenames.flatMap((filename) => {
    const match = pattern.exec(filename);

    if (
      !match ||
      match[1] !== requiredPrefix ||
      Number(match[2]) !== season ||
      Number(match[3]) >= beforeWeek
    ) {
      return [];
    }

    return [{
      week: Number(match[3]),
      revision: Number(match[4] ?? 1),
      filepath: path.join(directory, filename),
    }];
  }).sort((a, b) =>
    a.week - b.week || b.revision - a.revision
  );

  const history: ApprovedYahooStory[] = [];
  const selectedWeeks = new Set<number>();

  for (const item of matching) {
    if (selectedWeeks.has(item.week)) continue;
    const status = await getDraftApprovalStatus(item.filepath);

    // Rejected, modified, and unapproved drafts are not canon.
    if (status !== "approved") continue;

    const article = await readFile(item.filepath, "utf8");

    // Recheck approval if the file changed during reading.
    if (
      await getDraftApprovalStatus(item.filepath) !== "approved"
    ) {
      continue;
    }

    history.push(
      readStory(
        article,
        item.filepath,
        season,
        item.week,
        source,
      ),
    );
    selectedWeeks.add(item.week);
  }

  return history;
}
