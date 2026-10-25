import {
  exportApprovedDemo,
  getReportStatus,
  listPrivateDrafts,
} from "../publication/reportManager.js";

const [command, weekArgument] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "list": {
      const reports = await listPrivateDrafts();

      if (reports.length === 0) {
        console.log("No private reports found.");
        return;
      }

      for (const report of reports) {
        console.log(`Week ${report.week}: ${report.status}`);
      }

      return;
    }

    case "status": {
      const week = Number(weekArgument);

      console.log(`Week ${week}: ${await getReportStatus(week)}`);

      return;
    }

    case "export-demo": {
      const week = Number(weekArgument);
      const filepath = await exportApprovedDemo(week);

      console.log(`Demo exported privately: ${filepath}`);
      console.log("Nothing has been sent.");
      return;
    }

    default:
      throw new Error(
        "Usage: npx tsx src/cli/manageReports.ts " +
          "<list | status WEEK | export-demo WEEK>",
      );
  }
}

await main();
