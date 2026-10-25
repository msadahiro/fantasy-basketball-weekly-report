import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { hashDraft } from "./draftApproval.js";
import { prepareYahooShare } from "./yahooPublication.js";
import { assertYahooReportIdentity } from "./reportIdentity.js";

export type SharePlatform =
  | "whatsapp"
  | "discord"
  | "slack"
  | "email";

export interface ShareRequest {
  draftPath: string;
  leagueId: string;
  reportId: string;
  platform: SharePlatform;
  destinationId: string;
}

export interface PublicationReceipt {
  version: 1;
  status: "shared";
  source: "yahoo";
  leagueId: string;
  reportId: string;
  platform: SharePlatform;
  destinationId: string;
  draftPath: string;
  draftHash: string;
  shareHash: string;
  shareText: string;
  sharedAt: string;
}

const DEFAULT_DIRECTORY = "data/private/publications";

function validateRequest(request: ShareRequest): void {
  const identifiers = [
    request.leagueId,
    request.reportId,
    request.destinationId,
  ];

  if (
    identifiers.some(
      (value) =>
        typeof value !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    )
  ) {
    throw new Error(
      "League, report, and destination IDs must use lowercase slugs",
    );
  }

  if (
    typeof request.draftPath !== "string" ||
    request.draftPath.length === 0
  ) {
    throw new Error("A draft path is required");
  }

  if (
    !["whatsapp", "discord", "slack", "email"].includes(
      request.platform,
    )
  ) {
    throw new Error("Unknown sharing platform");
  }
}

function receiptPath(
  request: ShareRequest,
  directory: string,
): string {
  const key = JSON.stringify([
    request.leagueId,
    request.reportId,
    request.platform,
    request.destinationId,
  ]);

  const id = createHash("sha256")
    .update(key)
    .digest("hex");

  return path.join(directory, `${id}.json`);
}

async function assertNoConflictingPublishedDraft(
  request: ShareRequest,
  draftHash: string,
  directory: string,
): Promise<void> {
  let filenames: string[];

  try {
    filenames = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const filename of filenames) {
    if (!/^[a-f0-9]{64}\.json$/.test(filename)) {
      continue;
    }

    const filepath = path.join(directory, filename);
    const parsed: unknown = JSON.parse(
      await readFile(filepath, "utf8"),
    );

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Invalid existing publication receipt");
    }

    const candidate = parsed as Partial<PublicationReceipt>;

    if (
      candidate.leagueId !== request.leagueId ||
      candidate.reportId !== request.reportId
    ) {
      continue;
    }

    if (
      typeof candidate.draftPath !== "string" ||
      typeof candidate.platform !== "string" ||
      typeof candidate.destinationId !== "string"
    ) {
      throw new Error("Invalid existing publication receipt");
    }

    const previousRequest: ShareRequest = {
      draftPath: candidate.draftPath,
      leagueId: request.leagueId,
      reportId: request.reportId,
      platform: candidate.platform as SharePlatform,
      destinationId: candidate.destinationId,
    };

    const verified = await loadReportPublication(
      previousRequest,
      directory,
    );

    if (
      !verified ||
      receiptPath(previousRequest, directory) !== filepath
    ) {
      throw new Error("Existing publication failed verification");
    }

    if (verified.draftHash !== draftHash) {
      throw new Error(
        "Conflicting published articles for this league and week. " +
        "A different report version has already been shared.",
      );
    }
  }
}

export async function prepareReportForPlatform(
  request: ShareRequest,
  directory = DEFAULT_DIRECTORY,
): Promise<{
  shareText: string;
  draftHash: string;
}> {
  validateRequest(request);

  // Only WhatsApp formatting is implemented so far.
  if (request.platform !== "whatsapp") {
    throw new Error(
      `Formatting for ${request.platform} is not implemented yet`,
    );
  }

  // Reuse existing safeguards:
  // exact approval, real Yahoo data, no synthetic reports,
  // and no internal ranking methodology in public copy.
  const prepared = await prepareYahooShare(
    request.draftPath,
  );

  assertYahooReportIdentity(request, prepared.shareText);

  await assertNoConflictingPublishedDraft(
    request,
    prepared.draftSha256,
    directory,
  );

  return {
    shareText: prepared.shareText,
    draftHash: prepared.draftSha256,
  };
}

export async function recordReportPublication(
  request: ShareRequest,
  confirmation: string,
  directory = DEFAULT_DIRECTORY,
): Promise<{
  filepath: string;
  receipt: PublicationReceipt;
}> {
  if (confirmation !== "SHARED") {
    throw new Error(
      "Explicit SHARED confirmation is required",
    );
  }

  const prepared = await prepareReportForPlatform(request, directory);

  const receipt: PublicationReceipt = {
    version: 1,
    status: "shared",
    source: "yahoo",
    leagueId: request.leagueId,
    reportId: request.reportId,
    platform: request.platform,
    destinationId: request.destinationId,
    draftPath: request.draftPath,
    draftHash: prepared.draftHash,
    shareHash: hashDraft(prepared.shareText),
    shareText: prepared.shareText,
    sharedAt: new Date().toISOString(),
  };

  await mkdir(directory, { recursive: true });

  const filepath = receiptPath(request, directory);

  // Every league/report/platform/destination combination
  // receives its own immutable publication record.
  await writeFile(
    filepath,
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );

  return { filepath, receipt };
}

export async function loadReportPublication(
  request: ShareRequest,
  directory = DEFAULT_DIRECTORY,
): Promise<PublicationReceipt | null> {
  validateRequest(request);

  let raw: string;

  try {
    raw = await readFile(
      receiptPath(request, directory),
      "utf8",
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }

  const record = JSON.parse(raw) as Partial<PublicationReceipt>;

  if (
    record.version !== 1 ||
    record.status !== "shared" ||
    record.source !== "yahoo" ||
    record.leagueId !== request.leagueId ||
    record.reportId !== request.reportId ||
    record.platform !== request.platform ||
    record.destinationId !== request.destinationId ||
    record.draftPath !== request.draftPath ||
    typeof record.draftPath !== "string" ||
    typeof record.draftHash !== "string" ||
    typeof record.shareText !== "string" ||
    typeof record.shareHash !== "string" ||
    typeof record.sharedAt !== "string" ||
    hashDraft(record.shareText) !== record.shareHash
  ) {
    throw new Error("Publication record failed validation");
  }

  assertYahooReportIdentity(request, record.shareText);

  return record as PublicationReceipt;
}
