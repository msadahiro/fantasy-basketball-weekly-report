import { readFile, writeFile } from "node:fs/promises";

import {
  getDraftApprovalStatus,
  hashDraft,
} from "./draftApproval.js";
import { assertWhatsAppEditorial } from "./yahooChaosEditorial.js";

export interface SharedYahooReport {
  version: 1;
  sharedAt: string;
  draftSha256: string;
  shareSha256: string;
  draftText: string;
  shareText: string;
}

function buildShareableText(draft: string): string {
  if (
    !draft.includes(
      "PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
    ) ||
    draft.includes("DEMO ONLY") ||
    !draft.includes("PRIVATE DRAFT")
  ) {
    throw new Error("Only real Yahoo Power Ranking drafts can be shared");
  }

  assertWhatsAppEditorial(draft);

  const lines = draft.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim() === "🏀 *THE WEEKLY CHAOS REPORT*",
  );

  if (start < 0) {
    throw new Error("Missing Weekly Chaos Report heading");
  }

  // Exclude private review metadata from the WhatsApp copy.
  // Retain the provisional-data disclaimer in the article.
  const shareText = lines.slice(start).join("\n").trim();

  if (
    shareText.includes("PRIVATE DRAFT") ||
    shareText.includes("DEMO ONLY")
  ) {
    throw new Error("Private metadata leaked into shareable report");
  }

  assertWhatsAppEditorial(shareText);
  return shareText;
}

export async function prepareYahooShare(
  filepath: string,
): Promise<{
  draftText: string;
  shareText: string;
  draftSha256: string;
}> {
  const draftText = await readFile(filepath, "utf8");

  if ((await getDraftApprovalStatus(filepath)) !== "approved") {
    throw new Error(
      "Approve the exact current draft before preparing it for sharing",
    );
  }

  // Reject changes made during preparation.
  if ((await readFile(filepath, "utf8")) !== draftText) {
    throw new Error("Draft changed during share preparation");
  }

  return {
    draftText,
    shareText: buildShareableText(draftText),
    draftSha256: hashDraft(draftText),
  };
}

function sharedPath(filepath: string): string {
  return `${filepath}.shared.json`;
}

export async function recordYahooShared(
  filepath: string,
  confirmation: string,
): Promise<SharedYahooReport> {
  if (confirmation !== "SHARED") {
    throw new Error("Explicit SHARED confirmation required");
  }

  const prepared = await prepareYahooShare(filepath);

  const record: SharedYahooReport = {
    version: 1,
    sharedAt: new Date().toISOString(),
    draftSha256: prepared.draftSha256,
    shareSha256: hashDraft(prepared.shareText),
    draftText: prepared.draftText,
    shareText: prepared.shareText,
  };

  // No overwriting an existing publication record.
  await writeFile(
    sharedPath(filepath),
    JSON.stringify(record, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );

  return record;
}

export async function loadSharedYahooReport(
  filepath: string,
): Promise<SharedYahooReport | null> {
  let raw: string;

  try {
    raw = await readFile(sharedPath(filepath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  const record: unknown = JSON.parse(raw);

  if (
    typeof record !== "object" ||
    record === null ||
    !("version" in record) ||
    record.version !== 1 ||
    !("sharedAt" in record) ||
    typeof record.sharedAt !== "string" ||
    !("draftSha256" in record) ||
    typeof record.draftSha256 !== "string" ||
    !("shareSha256" in record) ||
    typeof record.shareSha256 !== "string" ||
    !("draftText" in record) ||
    typeof record.draftText !== "string" ||
    !("shareText" in record) ||
    typeof record.shareText !== "string"
  ) {
    throw new Error("Invalid Yahoo publication record");
  }

  if (
    hashDraft(record.draftText) !== record.draftSha256 ||
    hashDraft(record.shareText) !== record.shareSha256 ||
    buildShareableText(record.draftText) !== record.shareText
  ) {
    throw new Error("Yahoo publication record failed integrity checks");
  }

  return record as SharedYahooReport;
}
