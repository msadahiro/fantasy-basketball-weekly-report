import {
  assertYahooMatchupReadyForReport,
  validateYahooMatchupPeriod,
  validateYahooMatchupSchedule,
  type YahooMatchupEvidence,
  type YahooMatchupPeriod,
} from "./yahooMatchupPeriod.js";

interface ReportIdentity {
  leagueId: string;
  season: number;
  week: number;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function assertReadyYahooPeriodManifest(
  value: unknown,
  report: ReportIdentity,
): void {
  if (
    !isRecord(value) ||
    value.leagueId !== report.leagueId ||
    value.season !== report.season ||
    !Array.isArray(value.periods)
  ) {
    throw new Error("Yahoo period manifest identity mismatch");
  }

  if (value.periods.length !== report.week) {
    throw new Error(
      `Yahoo Week ${report.week} requires ${report.week} ` +
      "verified matchup periods",
    );
  }

  const entries: Array<{
    period: YahooMatchupPeriod;
    evidence: YahooMatchupEvidence;
  }> = [];

  for (const entry of value.periods) {
    if (
      !isRecord(entry) ||
      !isRecord(entry.period) ||
      !isRecord(entry.evidence)
    ) {
      throw new Error("Invalid Yahoo period manifest entry");
    }

    const p = entry.period;
    const e = entry.evidence;

    if (
      typeof p.leagueId !== "string" ||
      typeof p.season !== "number" ||
      typeof p.week !== "number" ||
      typeof p.startDate !== "string" ||
      typeof p.endDate !== "string" ||
      typeof p.status !== "string" ||
      typeof e.teamsWithFinalStats !== "number" ||
      typeof e.finalizedMatchups !== "number" ||
      !Number.isInteger(e.teamsWithFinalStats) ||
      !Number.isInteger(e.finalizedMatchups)
    ) {
      throw new Error("Invalid Yahoo period manifest fields");
    }

    const period = p as unknown as YahooMatchupPeriod;
    const evidence = e as unknown as YahooMatchupEvidence;

    validateYahooMatchupPeriod(period);
    entries.push({ period, evidence });
  }

  validateYahooMatchupSchedule(
    entries.map((entry) => entry.period),
  );

  const ordered = [...entries].sort(
    (a, b) => a.period.week - b.period.week,
  );

  for (let index = 0; index < ordered.length; index++) {
    const { period, evidence } = ordered[index]!;

    if (
      period.leagueId !== report.leagueId ||
      period.season !== report.season ||
      period.week !== index + 1
    ) {
      throw new Error(
        "Missing or mismatched official Yahoo matchup week",
      );
    }

    assertYahooMatchupReadyForReport(period, evidence);
  }
}
