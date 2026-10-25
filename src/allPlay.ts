export interface TeamStats {
  id: string;
  name: string;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  threes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

function categoryValues(team: TeamStats): number[] {
  return [
    team.fgm / team.fga,
    team.ftm / team.fta,
    team.threes,
    team.points,
    team.rebounds,
    team.assists,
    team.steals,
    team.blocks,
    -team.turnovers, // Fewer turnovers is better
  ];
}

export function calculateAllPlay(teams: TeamStats[]) {
  if (teams.length < 2) {
    throw new Error("At least two teams are required.");
  }

  const ids = teams.map((team) => team.id);

  if (new Set(ids).size !== ids.length) {
    throw new Error("Team IDs must be unique.");
  }

  for (const team of teams) {
    const numbers = [
      team.fgm,
      team.fga,
      team.ftm,
      team.fta,
      team.threes,
      team.points,
      team.rebounds,
      team.assists,
      team.steals,
      team.blocks,
      team.turnovers,
    ];

    if (
      team.fga <= 0 ||
      team.fta <= 0 ||
      numbers.some((value) => !Number.isFinite(value) || value < 0) ||
      team.fgm > team.fga ||
      team.ftm > team.fta
    ) {
      throw new Error(`Invalid statistics for ${team.name}`);
    }
  }

  return teams
    .map((team) => {
      let wins = 0;
      let losses = 0;
      let ties = 0;
      let categoryWins = 0;
      let categoryTies = 0;

      for (const opponent of teams) {
        if (opponent.id === team.id) continue;

        const own = categoryValues(team);
        const theirs = categoryValues(opponent);

        let won = 0;
        let lost = 0;

        for (let i = 0; i < 9; i++) {
          if (own[i]! > theirs[i]!) won++;
          else if (own[i]! < theirs[i]!) lost++;
        }

        categoryWins += won;
        categoryTies += 9 - won - lost;

        if (won > lost) wins++;
        else if (lost > won) losses++;
        else ties++;
      }

      return {
        id: team.id,
        team: team.name,
        wins,
        losses,
        ties,
        categoryWins,
        categoryTies,
        categoryLosses: 9 * (teams.length - 1) - categoryWins - categoryTies,
        categoryWinRate:
          (categoryWins + categoryTies * 0.5) / (9 * (teams.length - 1)),
        allPlayWinRate: (wins + ties * 0.5) / (teams.length - 1),
      };
    })
    .sort(
      (a, b) =>
        b.categoryWinRate - a.categoryWinRate ||
        b.categoryWins - a.categoryWins ||
        a.team.localeCompare(b.team),
    );
}
