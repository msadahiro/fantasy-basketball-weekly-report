import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export type DraftApprovalStatus = "unapproved" | "approved" | "modified";

interface ApprovalRecord {
  version: 1;
  sha256: string;
  approvedAt: string;
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

  return record.sha256 === hashDraft(content) ? "approved" : "modified";
}

export async function approvePrivateDraft(
  filepath: string,
  expectedHash: string,
): Promise<void> {
  const content = await readFile(filepath, "utf8");

  if (!content.includes("PRIVATE DRAFT") || !content.includes("DEMO ONLY")) {
    throw new Error("Not a private demo draft");
  }

  const currentHash = hashDraft(content);

  if (currentHash !== expectedHash) {
    throw new Error("Draft changed since preview");
  }

  const record: ApprovalRecord = {
    version: 1,
    sha256: currentHash,
    approvedAt: new Date().toISOString(),
  };

  await writeFile(approvalPath(filepath), JSON.stringify(record, null, 2), {
    mode: 0o600,
  });
}
