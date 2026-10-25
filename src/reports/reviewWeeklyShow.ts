import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import {
  approvePrivateDraft,
  getDraftApprovalStatus,
  hashDraft,
  rejectPrivateDraft,
} from "../publication/draftApproval.js";

const filepath = process.argv[2];

if (!filepath) {
  throw new Error("Usage: npx tsx src/reports/reviewWeeklyShow.ts <report-file>");
}

const content = await readFile(filepath, "utf8");
const expectedHash = hashDraft(content);

console.log("\n========== WEEKLY SHOW PREVIEW ==========\n");
console.log(content);
console.log("\n=========================================\n");
console.log(`Current status: ${await getDraftApprovalStatus(filepath)}`);

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

let answer: string;

try {
  answer = (
    await readline.question("Type APPROVE, REJECT, or CANCEL: ")
  ).trim();
} finally {
  readline.close();
}

if (answer === "APPROVE") {
  await approvePrivateDraft(filepath, expectedHash);
  console.log(`\nStatus: ${await getDraftApprovalStatus(filepath)}`);
  console.log("Approval recorded locally. Nothing has been sent.");
} else if (answer === "REJECT") {
  await rejectPrivateDraft(filepath);
  console.log(`\nStatus: ${await getDraftApprovalStatus(filepath)}`);
  console.log("Rejection recorded. Any earlier approval is revoked.");
} else if (answer === "CANCEL") {
  console.log("\nCanceled. Status unchanged. Nothing has been sent.");
} else {
  console.log("\nUnrecognized response. Treated as CANCEL. Nothing changed.");
}
