import type {
  YahooDisplayedTeam,
  YahooDisplayedWeek,
} from "../yahoo/yahooMatchupCsv.js";

import {
  assertPairingsCoverTeams,
  parseMatchupPairings,
  type MatchupPairings,
} from "../data/matchupPairings.js";

const categories = [
  { key: "fg_pct", higher: true, rounded: true },
  { key: "ft_pct", higher: true, rounded: true },
  { key: "threes", higher: true, rounded: false },
  { key: "points", higher: true, rounded: false },
  { key: "rebounds", higher: true, rounded: false },
  { key: "assists", higher: true, rounded: false },
  { key: "steals", higher: true, rounded: false },
  { key: "blocks", higher: true, rounded: false },
  { key: "turnovers", higher: false, rounded: false },
] as const;

type Outcome = "first" | "second" | "tie" | "uncertain";

function compare(
  first: YahooDisplayedTeam,
  second: YahooDisplayedTeam,
  category: (typeof categories)[number],
): Outcome {
  const a = first[category.key];
  const b = second[category.key];

  if (a === b) {
    return category.rounded ? "uncertain" : "tie";
  }

  const firstWins = category.higher ? a > b : a < b;

  return firstWins ? "first" : "second";
}

interface Tally {
  wins: number;
  losses: number;
  ties: number;
  uncertain: number;
}

export interface DisplayedRanking extends Tally {
  rank: number;
  id: string;
  name: string;
  midpoint: number;
  minimum: number;
  maximum: number;
}

export interface DisplayedMatchup {
  home: string;
  away: string;
  homeWins: number;
  awayWins: number;
  ties: number;
  uncertain: number;
}

export interface DisplayedAllPlayResult {
  season: number;
  week: number;
  provisional: true;
  comparisonsPerTeam: number;
  rankings: DisplayedRanking[];
  matchups: DisplayedMatchup[];
}

export function calculateDisplayedAllPlay(
  week: YahooDisplayedWeek,
  rawPairings?: MatchupPairings,
): DisplayedAllPlayResult {
  const pairings = rawPairings === undefined
    ? null
    : parseMatchupPairings(rawPairings);

  if (
    pairings &&
    (pairings.season !== week.season ||
      pairings.week !== week.week)
  ) {
    throw new Error("Pairings season/week does not match CSV");
  }

  if (week.teams.length !== 12) {
    throw new Error("Expected exactly 12 teams");
  }

  if (pairings) {
    assertPairingsCoverTeams(
      pairings,
      week.teams.map((team) => team.id),
    );
  }

  const byId = new Map(
    week.teams.map((team) => [team.id, team]),
  );

  const tallies = new Map<string, Tally>(
    week.teams.map((team) => [
      team.id,
      { wins: 0, losses: 0, ties: 0, uncertain: 0 },
    ]),
  );

  // Every team faces all 11 other teams across nine categories.
  for (let i = 0; i < week.teams.length; i++) {
    for (let j = i + 1; j < week.teams.length; j++) {
      const first = week.teams[i]!;
      const second = week.teams[j]!;

      const a = tallies.get(first.id)!;
      const b = tallies.get(second.id)!;

      for (const category of categories) {
        const outcome = compare(first, second, category);

        if (outcome === "first") {
          a.wins++;
          b.losses++;
        } else if (outcome === "second") {
          b.wins++;
          a.losses++;
        } else if (outcome === "tie") {
          a.ties++;
          b.ties++;
        } else {
          a.uncertain++;
          b.uncertain++;
        }
      }
    }
  }

  const total = (week.teams.length - 1) * categories.length;

  const rankings = week.teams
    .map((team) => {
      const tally = tallies.get(team.id)!;

      const base = tally.wins + tally.ties * 0.5;

      return {
        id: team.id,
        name: team.name,
        ...tally,

        // The midpoint assumes half-credit for each
        // unresolved comparison. This is an estimate,
        // not a claim that those categories were tied.
        midpoint: ((base + tally.uncertain * 0.5) / total) * 100,

        // Range of possible scores given the rounded data.
        minimum: (base / total) * 100,
        maximum: ((base + tally.uncertain) / total) * 100,
      };
    })
    .sort(
      (a, b) =>
        b.midpoint - a.midpoint ||
        a.id.localeCompare(b.id),
    )
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));

  const matchups = pairings?.pairings.map(
    ([homeId, awayId]): DisplayedMatchup => {
      const home = byId.get(homeId)!;
      const away = byId.get(awayId)!;

      const result: DisplayedMatchup = {
        home: home.name,
        away: away.name,
        homeWins: 0,
        awayWins: 0,
        ties: 0,
        uncertain: 0,
      };

      for (const category of categories) {
        const outcome = compare(home, away, category);

        if (outcome === "first") result.homeWins++;
        else if (outcome === "second") result.awayWins++;
        else if (outcome === "tie") result.ties++;
        else result.uncertain++;
      }

      return result;
    },
  ) ?? [];

  return {
    season: week.season,
    week: week.week,
    provisional: true,
    comparisonsPerTeam: total,
    rankings,
    matchups,
  };
}
