import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

import path from "node:path";

import {
  getDraftApprovalStatus,
  type DraftApprovalStatus,
} from "./draftApproval.js";

const DEFAULT_REPORT_DIR = "data/private/reports";
const DEFAULT_EXPORT_DIR = "data/private/exports";

function draftPath(week: number, directory: string): string {
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error("Invalid report week");
  }

  return path.join(directory, `demo-week-${week}.txt`);
}

export interface DraftSummary {
  week: number;
  status: DraftApprovalStatus;
}

export async function listPrivateDrafts(
  directory = DEFAULT_REPORT_DIR,
): Promise<DraftSummary[]> {
  let files: string[];

  try {
    files = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const weeks = files
    .map((filename) => /^demo-week-(\d+)\.txt$/.exec(filename))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .filter((week) => Number.isSafeInteger(week) && week > 0);

  const drafts = await Promise.all(
    weeks.map(async (week) => ({
      week,
      status: await getDraftApprovalStatus(draftPath(week, directory)),
    })),
  );

  return drafts.sort((a, b) => a.week - b.week);
}

export async function getReportStatus(
  week: number,
  directory = DEFAULT_REPORT_DIR,
): Promise<DraftApprovalStatus> {
  return getDraftApprovalStatus(draftPath(week, directory));
}

export async function exportApprovedDemo(
  week: number,
  reportDirectory = DEFAULT_REPORT_DIR,
  exportDirectory = DEFAULT_EXPORT_DIR,
): Promise<string> {
  const source = draftPath(week, reportDirectory);

  const content = await readFile(source, "utf8");

  if (!content.includes("PRIVATE DRAFT") || !content.includes("DEMO ONLY")) {
    throw new Error("Not a private demo report");
  }

  const status = await getDraftApprovalStatus(source);

  if (status !== "approved") {
    throw new Error(`Cannot export report: status is ${status}`);
  }

  // Check that the file has not changed while
  // we were verifying its approval.
  if ((await readFile(source, "utf8")) !== content) {
    throw new Error("Draft changed during export");
  }

  // Remove internal workflow labels, but retain
  // prominent synthetic-data disclosure.
  const body = content
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() !== "🔒 *PRIVATE DRAFT — NOT APPROVED*" &&
        line.trim() !== "DEMO ONLY — Nothing has been sent to WhatsApp.",
    )
    .join("\n")
    .trim();

  const exportedContent =
    "🧪 APPROVED DEMO — SYNTHETIC DATA ONLY\n" +
    "NOT REAL LEAGUE RESULTS\n\n" +
    body +
    "\n";

  await mkdir(exportDirectory, {
    recursive: true,
    mode: 0o700,
  });

  const destination = path.join(
    exportDirectory,
    `demo-week-${week}-approved.txt`,
  );

  // Never overwrite an existing export.
  await writeFile(destination, exportedContent, {
    flag: "wx",
    mode: 0o600,
  });

  return destination;
}
