import { createHash } from "node:crypto";

export const EDITORIAL_STYLES = [
  "deadpan",
  "investigator",
  "announcer",
  "pundit",
  "statistical",
  "satirical",
] as const;

export type EditorialStyle =
  (typeof EDITORIAL_STYLES)[number];

export const STYLE_GUIDANCE: Record<EditorialStyle, string> = {
  deadpan:
    "Deadpan comedian. Use dry irony, restraint, and understated disappointment.",
  investigator:
    "Absurd observer. Spot strange ironies and ridiculous implications without fake investigations.",
  announcer:
    "Energetic comic. Make genuinely remarkable fantasy outcomes sound hilariously excessive.",
  pundit:
    "Unfiltered friend. Deliver short, blunt, good-natured fantasy roasts.",
  statistical:
    "Statistical absurdist. Find an amusing contradiction without reciting numbers.",
  satirical:
    "Sharp satirist. Deliver playful roasts and exaggerated consequences, not news reports.",
};

export interface EditorialAssignmentInput {
  leagueId: string;
  season: number;
  week: number;
  teamIds: readonly string[];
}

export function assignEditorialStyles(
  input: EditorialAssignmentInput,
): Record<string, EditorialStyle> {
  const { leagueId, season, week, teamIds } = input;

  if (!leagueId.trim()) {
    throw new Error("Missing league ID");
  }

  if (!Number.isInteger(season) || season < 2000) {
    throw new Error("Invalid season");
  }

  if (!Number.isInteger(week) || week < 1) {
    throw new Error("Invalid matchup week");
  }

  if (
    teamIds.length !== 12 ||
    teamIds.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(teamIds).size !== 12
  ) {
    throw new Error("Expected 12 unique team IDs");
  }

  // Shuffle team order consistently for each league and season.
  // Do not use team names: managers can rename their teams.
  function sortKey(id: string): string {
    return createHash("sha256")
      .update(JSON.stringify([leagueId, season, id]))
      .digest("hex");
  }

  const ordered = [...teamIds].sort((a, b) => {
    const left = sortKey(a);
    const right = sortKey(b);

    if (left < right) return -1;
    if (left > right) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  // Twelve teams, six styles, two teams per style.
  // Each team receives a different style next matchup period.
  return Object.fromEntries(
    ordered.map((id, index) => [
      id,
      EDITORIAL_STYLES[
        (index + week - 1) % EDITORIAL_STYLES.length
      ],
    ]),
  ) as Record<string, EditorialStyle>;
}
