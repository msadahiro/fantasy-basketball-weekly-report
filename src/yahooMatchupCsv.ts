import { parse } from "csv-parse/sync";

const countingStats = [
  "threes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
] as const;

const headers = [
  "id",
  "name",
  "fg_pct",
  "ft_pct",
  ...countingStats,
];

export interface YahooDisplayedTeam {
  id: string;
  name: string;
  fg_pct: number;
  ft_pct: number;
  threes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

export interface YahooDisplayedWeek {
  season: number;
  week: number;
  finalized: false;
  source: "yahoo-rounded-display";
  teams: YahooDisplayedTeam[];
}

function parsePercentage(
  raw: string | undefined,
  name: string,
  category: string,
): number {
  const value = raw?.trim() ?? "";

  // Accept 0.503, .503, 0.81, 1.000, etc.
  // Do not accept 50.3 or percentages with excess precision.
  const valid =
    /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|\.\d{1,3})$/;

  if (!valid.test(value)) {
    throw new Error(
      `Invalid ${category} for ${name}: ${value}`,
    );
  }

  return Number(value);
}

function parseCount(
  raw: string | undefined,
  name: string,
  category: string,
): number {
  const value = raw?.trim() ?? "";

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(
      `Invalid or missing ${category} for ${name}`,
    );
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new Error(`Invalid ${category} for ${name}`);
  }

  return number;
}

export function createYahooCsvTemplate(): string {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const id = `team-${String(index + 1).padStart(2, "0")}`;

    return [
      id,
      "",
      ...Array.from({ length: 9 }, () => ""),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n") + "\n";
}

export function parseYahooMatchupCsv(
  content: string,
  season: number,
  week: number,
): YahooDisplayedWeek {
  if (
    !Number.isSafeInteger(season) ||
    season < 1 ||
    !Number.isSafeInteger(week) ||
    week < 1
  ) {
    throw new Error("Invalid season or week");
  }

  const records = parse(content, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (actual: string[]) => {
      if (
        actual.length !== headers.length ||
        actual.some((header, i) => header !== headers[i])
      ) {
        throw new Error("Unexpected Yahoo CSV headers");
      }

      return actual;
    },
  }) as Record<string, string>[];

  if (records.length !== 12) {
    throw new Error("Expected exactly 12 Yahoo teams");
  }

  const teams: YahooDisplayedTeam[] = records.map(
    (record, index) => {
      const id = record.id?.trim();
      const name = record.name?.trim();

      if (!id || !name) {
        throw new Error(
          `Missing team ID or name on row ${index + 2}`,
        );
      }

      return {
        id,
        name,
        fg_pct: parsePercentage(
          record.fg_pct,
          name,
          "FG%",
        ),
        ft_pct: parsePercentage(
          record.ft_pct,
          name,
          "FT%",
        ),
        threes: parseCount(
          record.threes,
          name,
          "3PM",
        ),
        points: parseCount(
          record.points,
          name,
          "PTS",
        ),
        rebounds: parseCount(
          record.rebounds,
          name,
          "REB",
        ),
        assists: parseCount(
          record.assists,
          name,
          "AST",
        ),
        steals: parseCount(
          record.steals,
          name,
          "STL",
        ),
        blocks: parseCount(
          record.blocks,
          name,
          "BLK",
        ),
        turnovers: parseCount(
          record.turnovers,
          name,
          "TO",
        ),
      };
    },
  );

  if (new Set(teams.map((team) => team.id)).size !== 12) {
    throw new Error("Duplicate Yahoo team IDs");
  }

  return {
    season,
    week,
    finalized: false,
    source: "yahoo-rounded-display",
    teams,
  };
}
