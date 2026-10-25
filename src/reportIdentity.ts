import path from "node:path";

export interface ReportIdentity {
  draftPath: string;
  leagueId: string;
  reportId: string;
}

const leagueNames: Record<string, string> = {
  "league-of-extraordinary-men": "LEAGUE OF EXTRAORDINARY MEN",
};

export function assertYahooReportIdentity(
  request: ReportIdentity,
  shareText: string,
): void {
  const leagueName = leagueNames[request.leagueId];

  if (!leagueName) {
    throw new Error(`Unknown league ID: ${request.leagueId}`);
  }

  const reportMatch =
    /^([1-9]\d{3})-week-([1-9]\d*)$/.exec(request.reportId);

  if (!reportMatch) {
    throw new Error("Invalid report ID; expected YYYY-week-N");
  }

  const filenameMatch =
    /^yahoo-provisional-power-chaos-season-([1-9]\d{3})-week-([1-9]\d*)(?:-v([1-9]\d*))?\.txt$/
      .exec(path.basename(request.draftPath));

  if (
    !filenameMatch ||
    reportMatch[1] !== filenameMatch[1] ||
    Number(reportMatch[2]) !== Number(filenameMatch[2]) ||
    (filenameMatch[3] !== undefined &&
      Number(filenameMatch[3]) < 2)
  ) {
    throw new Error(
      "Report ID does not match saved Yahoo draft filename",
    );
  }

  const expectedHeading =
    `*${leagueName} — WEEK ${Number(reportMatch[2])}*`;

  const headings = shareText
    .split(/\r?\n/)
    .filter((line) =>
      /^\*[^*\r\n]+ — WEEK [1-9]\d*\*$/.test(line)
    );

  if (
    headings.length !== 1 ||
    headings[0] !== expectedHeading
  ) {
    throw new Error(
      "Report header does not match selected league and week",
    );
  }
}
