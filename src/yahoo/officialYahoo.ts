import { readFileSync } from "node:fs";
import { z } from "zod";
import type { MatchupResult } from "../reports/matchupRecap.js";

const positive = z.number().int().positive();
const nonnegative = z.number().int().nonnegative();
const teamId = z.string().trim().min(1);

const standingsTeamSchema = z.object({
  id: teamId,
  name: z.string().trim().min(1),
  placement: z.number().int().min(1).max(12),
  wins: nonnegative,
  losses: nonnegative,
  ties: nonnegative,
}).strict();

export const officialStandingsSchema = z.object({
  season: positive,
  phase: z.enum(["regular-season", "playoff-final"]),
  recordScope: z.literal("regular-season"),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teams: z.array(standingsTeamSchema).length(12),
}).strict().superRefine((data, ctx) => {
  for (const field of ["id", "placement"] as const) {
    const values = data.teams.map((team) => team[field]);

    if (new Set(values).size !== 12) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate official ${field}`,
      });
    }
  }
});

export type OfficialStandings =
  z.infer<typeof officialStandingsSchema>;

export function parseOfficialStandings(
  input: unknown,
): OfficialStandings {
  return officialStandingsSchema.parse(input);
}

export function loadOfficialStandings(
  filepath: string,
): OfficialStandings {
  return parseOfficialStandings(
    JSON.parse(readFileSync(filepath, "utf8")) as unknown,
  );
}

const officialMatchupSchema = z.object({
  homeId: teamId,
  awayId: teamId,
  homeWins: z.number().int().min(0).max(9),
  awayWins: z.number().int().min(0).max(9),
  ties: z.number().int().min(0).max(9),
}).strict().superRefine((matchup, ctx) => {
  if (matchup.homeId === matchup.awayId) {
    ctx.addIssue({
      code: "custom",
      message: "A team cannot play itself",
    });
  }

  if (
    matchup.homeWins +
    matchup.awayWins +
    matchup.ties !== 9
  ) {
    ctx.addIssue({
      code: "custom",
      message: "A nine-category matchup must total 9",
    });
  }
});

export const officialMatchupsSchema = z.object({
  season: positive,
  week: positive,
  finalized: z.literal(true),
  matchups: z.array(officialMatchupSchema).length(6),
}).strict().superRefine((data, ctx) => {
  const ids = data.matchups.flatMap(
    (matchup) => [matchup.homeId, matchup.awayId],
  );

  if (new Set(ids).size !== 12) {
    ctx.addIssue({
      code: "custom",
      message: "Each team must appear exactly once",
    });
  }
});

export type OfficialMatchups =
  z.infer<typeof officialMatchupsSchema>;

export function parseOfficialMatchups(
  input: unknown,
): OfficialMatchups {
  return officialMatchupsSchema.parse(input);
}

export function loadOfficialMatchups(
  filepath: string,
): OfficialMatchups {
  return parseOfficialMatchups(
    JSON.parse(readFileSync(filepath, "utf8")) as unknown,
  );
}

// Cross-check our exact matchup calculations against Yahoo.
// Matchup order and home/away ordering may differ.
export function verifyOfficialMatchups(
  official: OfficialMatchups,
  calculated: MatchupResult[],
): void {
  if (calculated.length !== 6) {
    throw new Error("Expected six calculated matchups");
  }

  for (const result of official.matchups) {
    const calculatedMatchup = calculated.find(
      (matchup) =>
        (matchup.homeId === result.homeId &&
          matchup.awayId === result.awayId) ||
        (matchup.homeId === result.awayId &&
          matchup.awayId === result.homeId),
    );

    if (!calculatedMatchup) {
      throw new Error(
        `Missing calculated matchup for ${result.homeId}`,
      );
    }

    const sameOrder =
      calculatedMatchup.homeId === result.homeId;

    const homeWins = sameOrder
      ? calculatedMatchup.homeCategoryWins
      : calculatedMatchup.awayCategoryWins;

    const awayWins = sameOrder
      ? calculatedMatchup.awayCategoryWins
      : calculatedMatchup.homeCategoryWins;

    if (
      homeWins !== result.homeWins ||
      awayWins !== result.awayWins ||
      calculatedMatchup.ties !== result.ties
    ) {
      throw new Error(
        `Yahoo result mismatch: ${result.homeId} vs ${result.awayId}`,
      );
    }
  }
}
