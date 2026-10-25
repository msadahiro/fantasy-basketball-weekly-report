import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export type DraftApprovalStatus =
  | "unapproved"
  | "approved"
  | "modified"
  | "rejected";

interface ApprovalRecord {
  version: 1;
  sha256: string;
  approvedAt: string;
  decision?: "approved" | "rejected";
  decidedAt?: string;
}

export function hashDraft(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function approvalPath(filepath: string): string {
  return `${filepath}.approval.json`;
}

export async function getDraftApprovalStatus(
  filepath: string,
): Promise<DraftApprovalStatus> {
  const content = await readFile(filepath, "utf8");

  let raw: string;

  try {
    raw = await readFile(approvalPath(filepath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "unapproved";
    }

    throw error;
  }

  const record: unknown = JSON.parse(raw);

  if (
    typeof record !== "object" ||
    record === null ||
    !("version" in record) ||
    record.version !== 1 ||
    !("sha256" in record) ||
    typeof record.sha256 !== "string"
  ) {
    throw new Error("Invalid draft approval record");
  }

  const decision =
    "decision" in record && typeof record.decision === "string"
      ? record.decision
      : "approved";

  if (decision === "rejected") {
    return "rejected";
  }

  return record.sha256 === hashDraft(content) ? "approved" : "modified";
}

export async function approvePrivateDraft(
  filepath: string,
  expectedHash: string,
): Promise<void> {
  const content = await readFile(filepath, "utf8");

  const isDemo = content.includes("DEMO ONLY");

  const isProvisionalMatchup =
    content.includes("PROVISIONAL MATCHUP — NOT FINAL") &&
    content.includes("MANUALLY ENTERED — NOT INDEPENDENTLY VERIFIED");

  const isFinalizedWeeklyShow = content.includes(
    "REAL LEAGUE RESULTS — finalized weekly snapshot",
  );

  const isProvisionalYahoo = content.includes(
    "PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
  ) && content.includes("PROVISIONAL WEEKLY ALL-PLAY");

  if (
    !content.includes("PRIVATE DRAFT") ||
    (!isDemo &&
      !isProvisionalMatchup &&
      !isFinalizedWeeklyShow &&
      !isProvisionalYahoo)
  ) {
    throw new Error("Not an eligible private draft");
  }

  const currentHash = hashDraft(content);

  if (currentHash !== expectedHash) {
    throw new Error("Draft changed since preview");
  }

  const now = new Date().toISOString();

  const record: ApprovalRecord = {
    version: 1,
    sha256: currentHash,
    approvedAt: now,
    decision: "approved",
    decidedAt: now,
  };

  await writeFile(approvalPath(filepath), JSON.stringify(record, null, 2), {
    mode: 0o600,
  });
}

export async function rejectPrivateDraft(filepath: string): Promise<void> {
  const content = await readFile(filepath, "utf8");

  const now = new Date().toISOString();

  // Recording a rejection revokes any earlier approval: the stored
  // decision becomes "rejected" regardless of whether the hash matches.
  const record: ApprovalRecord = {
    version: 1,
    sha256: hashDraft(content),
    approvedAt: now,
    decision: "rejected",
    decidedAt: now,
  };

  await writeFile(approvalPath(filepath), JSON.stringify(record, null, 2), {
    mode: 0o600,
  });
}
