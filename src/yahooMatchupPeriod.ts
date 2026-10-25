export type YahooMatchupStatus =
  | "scheduled"
  | "in_progress"
  | "final";

export interface YahooMatchupPeriod {
  leagueId: string;
  season: number;
  week: number;
  startDate: string;
  endDate: string;
  status: YahooMatchupStatus;
}

export interface YahooMatchupEvidence {
  teamsWithFinalStats: number;
  finalizedMatchups: number;
}

function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid Yahoo matchup date: ${value}`);
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid Yahoo matchup date: ${value}`);
  }

  return timestamp / 86_400_000;
}

export function validateYahooMatchupPeriod(
  period: YahooMatchupPeriod,
): void {
  if (
    !period.leagueId ||
    !Number.isInteger(period.season) ||
    !Number.isInteger(period.week) ||
    period.week < 1
  ) {
    throw new Error("Invalid Yahoo matchup identity");
  }

  if (
    period.status !== "scheduled" &&
    period.status !== "in_progress" &&
    period.status !== "final"
  ) {
    throw new Error("Invalid Yahoo matchup status");
  }

  if (dayNumber(period.endDate) < dayNumber(period.startDate)) {
    throw new Error("Yahoo matchup ends before it starts");
  }
}

export function yahooMatchupDays(
  period: YahooMatchupPeriod,
): number {
  validateYahooMatchupPeriod(period);

  return dayNumber(period.endDate) -
    dayNumber(period.startDate) + 1;
}

export function yahooMatchupReportId(
  period: YahooMatchupPeriod,
): string {
  validateYahooMatchupPeriod(period);

  return `${period.season}-week-${period.week}`;
}

export function isYahooMatchupReadyForReport(
  period: YahooMatchupPeriod,
  evidence: YahooMatchupEvidence,
): boolean {
  validateYahooMatchupPeriod(period);

  return (
    period.status === "final" &&
    evidence.teamsWithFinalStats === 12 &&
    evidence.finalizedMatchups === 6
  );
}

export function assertYahooMatchupReadyForReport(
  period: YahooMatchupPeriod,
  evidence: YahooMatchupEvidence,
): void {
  if (!isYahooMatchupReadyForReport(period, evidence)) {
    throw new Error(
      `Yahoo Week ${period.week} is not ready for a final report`,
    );
  }
}

export function validateYahooMatchupSchedule(
  periods: readonly YahooMatchupPeriod[],
): void {
  const schedules = new Map<string, YahooMatchupPeriod[]>();

  for (const period of periods) {
    validateYahooMatchupPeriod(period);

    const key = `${period.leagueId}:${period.season}`;
    const list = schedules.get(key) ?? [];

    list.push(period);
    schedules.set(key, list);
  }

  for (const list of schedules.values()) {
    const sorted = [...list].sort((a, b) => a.week - b.week);

    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1]!;
      const current = sorted[i]!;

      if (previous.week === current.week) {
        throw new Error(
          `Duplicate official Yahoo Week ${current.week}`,
        );
      }

      if (
        dayNumber(current.startDate) <=
        dayNumber(previous.endDate)
      ) {
        throw new Error("Overlapping Yahoo matchup periods");
      }
    }
  }
}
