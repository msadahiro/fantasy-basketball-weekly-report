import { mkdir, writeFile } from "node:fs/promises";

import path from "node:path";
import type { ReportDraft } from "./reportDraft.js";

export async function savePrivateDraft(
  draft: ReportDraft,
  week: number,
  directory = "data/private/reports",
): Promise<string> {
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error("Invalid report week");
  }

  if (
    draft.status !== "draft" ||
    draft.source !== "synthetic" ||
    !draft.content.includes("PRIVATE DRAFT")
  ) {
    throw new Error("Invalid private demo draft");
  }

  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  const filename = `demo-week-${week}.txt`;
  const filepath = path.join(directory, filename);

  // "wx" means create a new file only.
  // Never silently overwrite an existing draft.
  await writeFile(filepath, draft.content, {
    flag: "wx",
    mode: 0o600,
  });

  return filepath;
}
