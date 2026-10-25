import { readFileSync } from "node:fs";
import { z } from "zod";

export const matchupPairingsSchema = z
  .object({
    season: z.number().int().positive(),
    week: z.number().int().positive(),
    pairings: z
      .array(z.tuple([z.string().min(1), z.string().min(1)]))
      .length(6),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.pairings.flat();

    for (const [home, away] of data.pairings) {
      if (home === away) {
        ctx.addIssue({
          code: "custom",
          message: `A team cannot play itself: ${home}`,
          path: ["pairings"],
        });
      }
    }

    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "A team appears in more than one pairing",
        path: ["pairings"],
      });
    }
  });

export type MatchupPairings = z.infer<typeof matchupPairingsSchema>;

export function parseMatchupPairings(input: unknown): MatchupPairings {
  return matchupPairingsSchema.parse(input);
}

export function loadMatchupPairings(path: string): MatchupPairings {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parseMatchupPairings(raw);
}

export function assertPairingsCoverTeams(
  pairings: MatchupPairings,
  teamIds: string[],
): void {
  const uniqueTeams = new Set(teamIds);

  if (uniqueTeams.size !== 12) {
    throw new Error("Expected exactly 12 unique team IDs");
  }

  const paired = pairings.pairings.flat();
  const pairedSet = new Set(paired);

  const unknown = paired.filter((id) => !uniqueTeams.has(id));

  if (unknown.length > 0) {
    throw new Error(
      `Pairing references unknown team ID(s): ${[...new Set(unknown)].join(", ")}`,
    );
  }

  const missing = [...uniqueTeams].filter((id) => !pairedSet.has(id));

  if (missing.length > 0) {
    throw new Error(
      `Pairings are missing team ID(s): ${missing.join(", ")}`,
    );
  }
}
