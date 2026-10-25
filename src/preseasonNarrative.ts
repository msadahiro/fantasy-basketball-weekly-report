export interface RankedTeam {
  id: string;
  team: string;
  rank: number;
}

export function buildWeekOnePreseasonRecap(
  rankings: readonly RankedTeam[],
  movement: ReadonlyMap<string, number>,
): string {
  if (rankings.length !== 12 || movement.size !== 12) {
    throw new Error("Expected complete 12-team preseason movement");
  }

  const ids = new Set<string>();
  const currentRanks = new Set<number>();
  const originalRanks = new Set<number>();

  const teams = rankings.map((team) => {
    const change = movement.get(team.id);
    const originalRank = team.rank + (change ?? 0);

    if (
      ids.has(team.id) ||
      !Number.isInteger(team.rank) ||
      team.rank < 1 ||
      team.rank > 12 ||
      !Number.isInteger(change) ||
      originalRank < 1 ||
      originalRank > 12 ||
      currentRanks.has(team.rank) ||
      originalRanks.has(originalRank)
    ) {
      throw new Error("Invalid preseason movement data");
    }

    ids.add(team.id);
    currentRanks.add(team.rank);
    originalRanks.add(originalRank);

    return {
      ...team,
      change: change!,
      originalRank,
    };
  });

  const favorite = teams.find(
    (team) => team.originalRank === 1,
  )!;

  const riser = teams
    .filter((team) => team.change > 0)
    .sort((a, b) =>
      b.change - a.change || a.rank - b.rank
    )[0];

  if (!riser) {
    return (
      "The preseason predictions have survived their first test. " +
      "All twelve teams remain in their original order, " +
      "with no movement after Week 1. " +
      "The statistical Power Rankings agree with the preseason " +
      "pecking order for now, but the season is only beginning."
    );
  }

  const favoriteStory = favorite.rank === 1
    ? `Preseason favorite ${favorite.team} remains #1.`
    : `Preseason favorite ${favorite.team} has fallen to #${favorite.rank}.`;

  return (
    `The preseason receipts are already coming due. ` +
    `${riser.team} climbed ${riser.change} spots, ` +
    `from preseason #${riser.originalRank} to #${riser.rank}. ` +
    `${favoriteStory} ` +
    `It's only Week 1, but those draft-night predictions ` +
    `are already being tested.`
  );
}
