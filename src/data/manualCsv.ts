import { parse } from "csv-parse/sync";
import { parseWeeklyData } from "./weeklyData.js";

const stats = [
  "fgm",
  "fga",
  "ftm",
  "fta",
  "threes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
] as const;

const headers = ["id", "name", ...stats];

export function createCsvTemplate(): string {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const id = `team-${String(i + 1).padStart(2, "0")}`;

    return [id, "", ...stats.map(() => "")].join(",");
  });

  return [headers.join(","), ...rows].join("\n") + "\n";
}

export function convertManualCsv(
  content: string,
  season: number,
  week: number,
) {
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
    columns: (actualHeaders: string[]) => {
      if (
        actualHeaders.length !== headers.length ||
        actualHeaders.some((header, index) => header !== headers[index])
      ) {
        throw new Error("Unexpected CSV headers");
      }

      return actualHeaders;
    },
  }) as Record<string, string>[];

  if (records.length !== 12) {
    throw new Error("Expected exactly 12 teams");
  }

  const teams = records.map((record, index) => {
    const id = record.id?.trim();
    const name = record.name?.trim();

    if (!id || !name) {
      throw new Error(`Missing team ID or name on row ${index + 2}`);
    }

    const values: Record<string, number> = {};

    for (const stat of stats) {
      const raw = record[stat];

      if (raw === undefined || !/^(0|[1-9]\d*)$/.test(raw)) {
        throw new Error(`Invalid or missing ${stat} for ${name}`);
      }

      const value = Number(raw);

      if (!Number.isSafeInteger(value)) {
        throw new Error(`Invalid ${stat} for ${name}`);
      }

      values[stat] = value;
    }

    return { id, name, ...values };
  });

  // Validate using our existing basketball data schema.
  return parseWeeklyData({
    season,
    week,
    finalized: true,
    teams,
  });
}
