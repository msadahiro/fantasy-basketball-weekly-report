import { createInterface } from "node:readline/promises";

import { hashDraft } from "../publication/draftApproval.js";
import {
  prepareReportForPlatform,
  recordReportPublication,
} from "../publication/reportPublication.js";
import {
  parseReportShareArgs,
} from "../publication/reportShareCli.js";

try {
  const request = parseReportShareArgs(
    process.argv.slice(2),
  );

  const prepared = await prepareReportForPlatform(
    request,
  );

  console.log("\nReport publication confirmation");
  console.log(`League: ${request.leagueId}`);
  console.log(`Report: ${request.reportId}`);
  console.log(`Platform: ${request.platform}`);
  console.log(`Destination: ${request.destinationId}`);
  console.log(
    `Content SHA-256: ${hashDraft(prepared.shareText)}`,
  );

  console.log(
    "\nNothing will be sent automatically.",
  );
  console.log(
    "Confirm only after sending the exact prepared article yourself.",
  );

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let answer: string;

  try {
    answer = (
      await readline.question(
        "\nType SHARED to record publication: ",
      )
    ).trim();
  } finally {
    readline.close();
  }

  if (answer !== "SHARED") {
    console.log("Canceled. No publication recorded.");
  } else {
    const result = await recordReportPublication(
      request,
      answer,
    );

    console.log(
      `Publication recorded: ${result.filepath}`,
    );
    console.log(
      `Confirmed at: ${result.receipt.sharedAt}`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
}
