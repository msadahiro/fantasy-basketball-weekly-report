import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashDraft } from "./draftApproval.js";
import { getLeagueConfig } from "../config/leagueConfig.js";
import {
  parseSharedYahooStory,
  type ApprovedYahooStory,
} from "../editorial/yahooStoryHistory.js";

export interface ManualYahooReceipt {
  version: 1;
  status: "shared";
  origin: "manual-whatsapp";
  verification: "not-independently-verified";
  leagueId: string;
  reportId: string;
  platform: "whatsapp";
  destinationId: "league-whatsapp-chat";
  articlePath: string;
  articleSha256: string;
  sharedDate: string;
  recordedAt: string;
}

const DEFAULT_DIRECTORY =
  "data/private/manual-publications/receipts";

function validateDate(date: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`)
      .toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid publication date");
  }
}

function validateArticle(
  text: string,
  articlePath: string,
  leagueId: string,
  reportId: string,
): ApprovedYahooStory {
  const match = /^([1-9]\d{3})-week-([1-9]\d*)$/.exec(reportId);

  if (!match) {
    throw new Error("Invalid manual publication report ID");
  }

  if (path.basename(articlePath) !== `${reportId}-whatsapp.txt`) {
    throw new Error("Manual publication filename does not match report ID");
  }

  const season = Number(match[1]);
  const week = Number(match[2]);

  const expectedHeader =
    `*${getLeagueConfig(leagueId).displayName} — WEEK ${week}*`;

  const headers = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      /^\*[^*\r\n]+ — WEEK [1-9]\d*\*$/.test(line)
    );

  if (
    headers.length !== 1 ||
    headers[0]!.toUpperCase() !== expectedHeader.toUpperCase()
  ) {
    throw new Error("Manual publication league/week header mismatch");
  }

  return parseSharedYahooStory(
    text,
    articlePath,
    season,
    week,
  );
}

export async function recordManualYahooPublication(
  request: {
    articlePath: string;
    leagueId: string;
    reportId: string;
    sharedDate: string;
    confirmation: "SHARED";
  },
  directory = DEFAULT_DIRECTORY,
): Promise<string> {
  if (request.confirmation !== "SHARED") {
    throw new Error("Explicit SHARED confirmation required");
  }

  validateDate(request.sharedDate);

  const text = await readFile(request.articlePath, "utf8");

  validateArticle(
    text,
    request.articlePath,
    request.leagueId,
    request.reportId,
  );

  const receipt: ManualYahooReceipt = {
    version: 1,
    status: "shared",
    origin: "manual-whatsapp",
    verification: "not-independently-verified",
    leagueId: request.leagueId,
    reportId: request.reportId,
    platform: "whatsapp",
    destinationId: "league-whatsapp-chat",
    articlePath: request.articlePath,
    articleSha256: hashDraft(text),
    sharedDate: request.sharedDate,
    recordedAt: new Date().toISOString(),
  };

  await mkdir(directory, { recursive: true });

  const receiptPath = path.join(
    directory,
    `${request.leagueId}-${request.reportId}-whatsapp.json`,
  );

  await writeFile(
    receiptPath,
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );

  return receiptPath;
}

export async function loadManualYahooPublications(
  request: {
    leagueId: string;
    season: number;
    beforeWeek: number;
    directory?: string;
  },
): Promise<Array<{
  receipt: ManualYahooReceipt;
  story: ApprovedYahooStory;
}>> {
  const directory = request.directory ?? DEFAULT_DIRECTORY;
  let filenames: string[];

  try {
    filenames = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const results: Array<{
    receipt: ManualYahooReceipt;
    story: ApprovedYahooStory;
  }> = [];

  for (const filename of filenames.filter(
    (name) => name.endsWith(".json"),
  )) {
    const receipt = JSON.parse(
      await readFile(path.join(directory, filename), "utf8"),
    ) as ManualYahooReceipt;

    if (receipt.leagueId !== request.leagueId) continue;

    const match =
      /^([1-9]\d{3})-week-([1-9]\d*)$/.exec(receipt.reportId);

    if (!match) {
      throw new Error("Invalid manual publication report ID");
    }

    const season = Number(match[1]);
    const week = Number(match[2]);

    if (season !== request.season || week >= request.beforeWeek) {
      continue;
    }

    validateDate(receipt.sharedDate);

    if (
      filename !==
        `${receipt.leagueId}-${receipt.reportId}-whatsapp.json` ||
      receipt.version !== 1 ||
      receipt.status !== "shared" ||
      receipt.origin !== "manual-whatsapp" ||
      receipt.verification !== "not-independently-verified" ||
      receipt.platform !== "whatsapp" ||
      receipt.destinationId !== "league-whatsapp-chat" ||
      typeof receipt.articlePath !== "string" ||
      typeof receipt.articleSha256 !== "string" ||
      typeof receipt.recordedAt !== "string"
    ) {
      throw new Error("Invalid manual publication receipt");
    }

    const text = await readFile(receipt.articlePath, "utf8");

    if (hashDraft(text) !== receipt.articleSha256) {
      throw new Error("Manual publication article changed after import");
    }

    const story = validateArticle(
      text,
      receipt.articlePath,
      receipt.leagueId,
      receipt.reportId,
    );

    results.push({ receipt, story });
  }

  return results;
}
