export interface PreseasonRankings {
  leagueId: string;
  season: number;
  type: "editorial-preseason";
  rankings: Array<{
    rank: number;
    name: string;
    currentName?: string;
  }>;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

export function parsePreseasonRankings(
  raw: string,
  leagueId: string,
  season: number,
): PreseasonRankings {
  const value = JSON.parse(raw) as PreseasonRankings;

  if (
    value.leagueId !== leagueId ||
    value.season !== season ||
    value.type !== "editorial-preseason" ||
    !Array.isArray(value.rankings) ||
    value.rankings.length !== 12
  ) {
    throw new Error("Preseason league, season, or roster mismatch");
  }

  const ranks = new Set<number>();
  const names = new Set<string>();
  const currentNames = new Set<string>();

  for (const entry of value.rankings) {
    if (
      !entry ||
      !Number.isInteger(entry.rank) ||
      entry.rank < 1 ||
      entry.rank > 12 ||
      typeof entry.name !== "string" ||
      !normalizeName(entry.name) ||
      (entry.currentName !== undefined &&
        (typeof entry.currentName !== "string" ||
          !normalizeName(entry.currentName)))
    ) {
      throw new Error("Invalid preseason ranking entry");
    }

    const name = normalizeName(entry.name);
    const currentName = normalizeName(
      entry.currentName ?? entry.name,
    );

    if (
      ranks.has(entry.rank) ||
      names.has(name) ||
      currentNames.has(currentName)
    ) {
      throw new Error("Duplicate preseason rank or team name");
    }

    ranks.add(entry.rank);
    names.add(name);
    currentNames.add(currentName);
  }

  return value;
}

export function calculatePreseasonMovements(
  preseason: PreseasonRankings,
  weekTeams: readonly { id: string; name: string }[],
  rankings: readonly { id: string; rank: number }[],
): Map<string, number> {
  if (weekTeams.length !== 12 || rankings.length !== 12) {
    throw new Error("Expected 12 real league teams");
  }

  const preseasonByName = new Map(
    preseason.rankings.map((entry) => [
      normalizeName(entry.currentName ?? entry.name),
      entry.rank,
    ]),
  );

  const namesById = new Map<string, string>();

  for (const team of weekTeams) {
    if (namesById.has(team.id)) {
      throw new Error(`Duplicate Yahoo team ID: ${team.id}`);
    }
    namesById.set(team.id, normalizeName(team.name));
  }

  const movements = new Map<string, number>();
  const matchedNames = new Set<string>();

  for (const team of rankings) {
    const name = namesById.get(team.id);
    const preseasonRank = name === undefined
      ? undefined
      : preseasonByName.get(name);

    if (preseasonRank === undefined) {
      throw new Error(
        `Cannot match Yahoo team ${team.id} to preseason rankings. ` +
        "Check the team names before publishing.",
      );
    }

    if (
      matchedNames.has(name!) ||
      movements.has(team.id) ||
      !Number.isInteger(team.rank) ||
      team.rank < 1 ||
      team.rank > 12
    ) {
      throw new Error("Invalid or duplicate Week 1 ranking");
    }

    matchedNames.add(name!);
    movements.set(team.id, preseasonRank - team.rank);
  }

  if (matchedNames.size !== 12) {
    throw new Error("Incomplete preseason-to-Yahoo team mapping");
  }

  return movements;
}
