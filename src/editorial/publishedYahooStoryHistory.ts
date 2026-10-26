import { loadManualYahooPublications } from "../publication/manualYahooPublication.js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadReportPublication,
  type PublicationReceipt,
  type ShareRequest,
} from "../publication/reportPublication.js";
import {
  parseSharedYahooStory,
  type ApprovedYahooStory,
} from "./yahooStoryHistory.js";

export interface PublishedStoryRequest {
  leagueId: string;
  season: number;
  beforeWeek: number;
  directory?: string;
  manualDirectory?: string;
}

export async function loadPublishedYahooStoryHistory(
  request: PublishedStoryRequest,
): Promise<ApprovedYahooStory[]> {
  const {
    leagueId,
    season,
    beforeWeek,
    directory = "data/private/publications",
  } = request;

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(leagueId) ||
    !Number.isSafeInteger(season) ||
    season < 1 ||
    !Number.isSafeInteger(beforeWeek) ||
    beforeWeek < 1
  ) {
    throw new Error("Invalid published story history request");
  }

  let filenames: string[];

  try {
    filenames = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      filenames = [];
    } else {
      throw error;
    }
  }

  const selected = new Map<
    number,
    { draftHash: string; story: ApprovedYahooStory }
  >();

  for (const filename of filenames.filter(
    (name) => name.endsWith(".json"),
  )) {
    const filepath = path.join(directory, filename);

    const parsed: unknown = JSON.parse(
      await readFile(filepath, "utf8"),
    );

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      throw new Error(`Invalid publication receipt: ${filepath}`);
    }

    const candidate = parsed as Partial<PublicationReceipt>;

    if (candidate.leagueId !== leagueId) {
      continue;
    }

    const match = typeof candidate.reportId === "string"
      ? /^([1-9]\d{3})-week-([1-9]\d*)$/.exec(
          candidate.reportId,
        )
      : null;

    if (!match) {
      throw new Error(`Invalid publication report ID: ${filepath}`);
    }

    const year = Number(match[1]);
    const week = Number(match[2]);

    if (
      year !== season ||
      week >= beforeWeek
    ) {
      continue;
    }

    const shareRequest: ShareRequest = {
      draftPath: candidate.draftPath as string,
      leagueId,
      reportId: candidate.reportId!,
      platform: candidate.platform!,
      destinationId: candidate.destinationId!,
    };

    // Reuse the receipt integrity and league/period checks.
    const verified = await loadReportPublication(
      shareRequest,
      directory,
    );

    if (
      !verified ||
      JSON.stringify(verified) !== JSON.stringify(parsed)
    ) {
      throw new Error(
        `Publication receipt failed verification: ${filepath}`,
      );
    }

    const existing = selected.get(week);

    if (existing) {
      if (existing.draftHash !== verified.draftHash) {
        throw new Error(
          `Conflicting published articles for ` +
          `${leagueId}, season ${season}, week ${week}`,
        );
      }

      // Same canonical article, another destination:
      // one storyline, not two.
      continue;
    }

    const story = parseSharedYahooStory(
      verified.shareText,
      verified.draftPath,
      year,
      week,
    );

    selected.set(week, {
      draftHash: verified.draftHash,
      story,
    });
  }

  const manualDirectory = request.manualDirectory ??
    (directory === "data/private/publications"
      ? "data/private/manual-publications/receipts"
      : path.join(directory, "manual-receipts"));

  const manual = await loadManualYahooPublications({
    leagueId,
    season,
    beforeWeek,
    directory: manualDirectory,
  });

  for (const { receipt, story } of manual) {
    const existing = selected.get(story.week);

    if (existing && existing.story.sha256 !== story.sha256) {
      throw new Error(
        `Conflicting published articles for ${leagueId}, ` +
        `season ${season}, week ${story.week}`,
      );
    }

    if (!existing) {
      selected.set(story.week, {
        draftHash: receipt.articleSha256,
        story,
      });
    }
  }

  return [...selected.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item.story);
}
