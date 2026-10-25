import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
} from "../publication/draftApproval.js";

const filepath = process.argv[2];

if (!filepath) {
  throw new Error("Usage: npx tsx src/cli/reviewDraft.ts <report-file>");
}

const content = await readFile(filepath, "utf8");
const expectedHash = hashDraft(content);

console.log("\n========== REPORT PREVIEW ==========\n");
console.log(content);
console.log("\n====================================\n");

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

let answer: string;

try {
  answer = await readline.question(
    "Type APPROVE to approve this exact draft: ",
  );
} finally {
  readline.close();
}

if (answer === "APPROVE") {
  await approvePrivateDraft(filepath, expectedHash);

  const status = await getDraftApprovalStatus(filepath);

  console.log(`\nReview status: ${status}`);
  console.log("Approval recorded locally. Nothing sent.");
} else {
  console.log("\nApproval canceled. Nothing changed.");
}
