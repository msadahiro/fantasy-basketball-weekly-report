import { readFileSync } from "node:fs";
import { z } from "zod";

const count = z.number().int().nonnegative();

const teamSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    fgm: count,
    fga: count,
    ftm: count,
    fta: count,
    threes: count,
    points: count,
    rebounds: count,
    assists: count,
    steals: count,
    blocks: count,
    turnovers: count,
  })
  .strict()
  .refine((team) => team.fgm <= team.fga, {
    message: "FGM cannot exceed FGA",
    path: ["fgm"],
  })
  .refine((team) => team.ftm <= team.fta, {
    message: "FTM cannot exceed FTA",
    path: ["ftm"],
  });

export const weeklyDataSchema = z
  .object({
    season: z.number().int().positive(),
    week: z.number().int().positive(),
    finalized: z.literal(true),
    teams: z.array(teamSchema).length(12),
  })
  .superRefine((data, ctx) => {
    const ids = data.teams.map((team) => team.id);

    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Team IDs must be unique",
        path: ["teams"],
      });
    }
  });

export type WeeklyData = z.infer<typeof weeklyDataSchema>;

export function parseWeeklyData(input: unknown): WeeklyData {
  return weeklyDataSchema.parse(input);
}

export function loadWeeklyData(path: string): WeeklyData {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parseWeeklyData(raw);
}
