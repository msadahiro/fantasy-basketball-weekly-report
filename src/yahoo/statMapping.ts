import type { TeamStats } from "../allPlay.js";

export const statFields = [
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

export type StatField = (typeof statFields)[number];

export type StatIdMap = Record<StatField, string>;

// Intermediate representation, NOT Yahoo's raw API format.
export interface ExtractedTeamStats {
  id: string;
  name: string;
  stats: {
    id: string;
    value: string | number | null;
  }[];
}

export function mapTeamStats(
  team: ExtractedTeamStats,
  mapping: StatIdMap,
): TeamStats {
  // Every field must have a distinct stat ID.
  const mappedIds = statFields.map((field) => mapping[field]);

  if (
    mappedIds.some((id) => !id) ||
    new Set(mappedIds).size !== mappedIds.length
  ) {
    throw new Error("Invalid or duplicate stat mappings");
  }

  // Reject duplicate incoming statistics.
  const values = new Map<string, string | number | null>();

  for (const stat of team.stats) {
    if (values.has(stat.id)) {
      throw new Error(`Duplicate incoming stat: ${stat.id}`);
    }
    values.set(stat.id, stat.value);
  }

  const totals = {} as Record<StatField, number>;

  for (const field of statFields) {
    const id = mapping[field];
    const raw = values.get(id);

    if (raw === undefined || raw === null || String(raw).trim() === "") {
      throw new Error(`Missing ${field} for ${team.name}`);
    }

    const value = Number(raw);

    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid ${field} for ${team.name}`);
    }

    totals[field] = value;
  }

  return {
    id: team.id,
    name: team.name,
    ...totals,
  };
}
