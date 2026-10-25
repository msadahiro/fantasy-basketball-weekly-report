import {
  prepareReportForPlatform,
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

  process.stdout.write(`${prepared.shareText}\n`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
}
