import type { YahooDisplayedWeek } from "./yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "./yahooDisplayedAllPlay.js";

interface RateBand {
  midpoint: number;
  minimum: number;
  maximum: number;
}

interface Totals {
  wins: number;
  losses: number;
  ties: number;
  uncertain: number;
}

export interface YahooPowerRanking {
  id: string;
  team: string;
  rank: number;
  previousPowerRank: number | null;
  movement: number | null;
  latestAllPlayRank: number;
  weeklyCategoryWinRate: number;
  seasonRate: number;
  recentRate: number;
  powerScore: number;
  minimumPowerScore: number;
  maximumPowerScore: number;
  seasonWins: number;
  seasonLosses: number;
  seasonTies: number;
  seasonUncertain: number;
}

export interface YahooRankingWeek {
  season: number;
  week: number;
  provisional: true;
  rankings: YahooPowerRanking[];
}

function average(
  rates: RateBand[],
  field: keyof RateBand,
): number {
  return rates.reduce(
    (total, rate) => total + rate[field],
    0,
  ) / rates.length;
}

function weightedRecent(
  rates: RateBand[],
  field: keyof RateBand,
): number {
  const recent = rates.slice(-3);
  const weightTotal =
    (recent.length * (recent.length + 1)) / 2;

  return recent.reduce(
    (total, rate, index) =>
      total + rate[field] * (index + 1),
    0,
  ) / weightTotal;
}

export function calculateYahooRankingHistory(
  weeks: YahooDisplayedWeek[],
): YahooRankingWeek[] {
  if (weeks.length === 0) {
    throw new Error("At least one Yahoo week is required");
  }

  const ordered = [...weeks].sort(
    (a, b) => a.week - b.week,
  );

  const season = ordered[0]!.season;
  let expectedIds: Set<string> | undefined;
  let previousRanks = new Map<string, number>();

  const ratesById = new Map<string, RateBand[]>();
  const totalsById = new Map<string, Totals>();

  return ordered.map((snapshot, index) => {
    // A season-long rating must not silently omit weeks.
    const expectedWeek = index + 1;

    if (snapshot.week !== expectedWeek) {
      throw new Error(
        `Missing or duplicate Yahoo week: expected ${expectedWeek}, got ${snapshot.week}`,
      );
    }

    if (snapshot.season !== season) {
      throw new Error("Yahoo season changed between weeks");
    }

    const ids = new Set(
      snapshot.teams.map((team) => team.id),
    );

    if (snapshot.teams.length !== 12 || ids.size !== 12) {
      throw new Error("Expected twelve unique Yahoo team IDs");
    }

    const previousIds = expectedIds;

    if (
      previousIds &&
      [...ids].some((id) => !previousIds.has(id))
    ) {
      throw new Error(
        `Yahoo team IDs changed in week ${snapshot.week}`,
      );
    }

    expectedIds = ids;

    // No pairing information is necessary for All-Play.
    const weekly = calculateDisplayedAllPlay(snapshot);

    for (const team of weekly.rankings) {
      const rates = ratesById.get(team.id) ?? [];

      rates.push({
        midpoint: team.midpoint / 100,
        minimum: team.minimum / 100,
        maximum: team.maximum / 100,
      });

      ratesById.set(team.id, rates);

      const totals = totalsById.get(team.id) ?? {
        wins: 0,
        losses: 0,
        ties: 0,
        uncertain: 0,
      };

      totals.wins += team.wins;
      totals.losses += team.losses;
      totals.ties += team.ties;
      totals.uncertain += team.uncertain;

      totalsById.set(team.id, totals);
    }

    const scored = weekly.rankings.map((team) => {
      const rates = ratesById.get(team.id)!;
      const totals = totalsById.get(team.id)!;

      const seasonRate = average(rates, "midpoint");
      const recentRate = weightedRecent(rates, "midpoint");

      const powerScore =
        seasonRate * 0.6 + recentRate * 0.4;

      const minimumPowerScore =
        average(rates, "minimum") * 0.6 +
        weightedRecent(rates, "minimum") * 0.4;

      const maximumPowerScore =
        average(rates, "maximum") * 0.6 +
        weightedRecent(rates, "maximum") * 0.4;

      return {
        id: team.id,
        team: team.name,
        latestAllPlayRank: team.rank,
        weeklyCategoryWinRate: team.midpoint / 100,
        seasonRate,
        recentRate,
        powerScore,
        minimumPowerScore,
        maximumPowerScore,
        seasonWins: totals.wins,
        seasonLosses: totals.losses,
        seasonTies: totals.ties,
        seasonUncertain: totals.uncertain,
      };
    });

    scored.sort(
      (a, b) =>
        b.powerScore - a.powerScore ||
        b.seasonRate - a.seasonRate ||
        a.team.localeCompare(b.team) ||
        a.id.localeCompare(b.id),
    );

    const rankings: YahooPowerRanking[] =
      scored.map((team, position) => {
        const rank = position + 1;
        const previousPowerRank =
          previousRanks.get(team.id) ?? null;

        return {
          ...team,
          rank,
          previousPowerRank,
          movement:
            previousPowerRank === null
              ? null
              : previousPowerRank - rank,
        };
      });

    previousRanks = new Map(
      rankings.map((team) => [team.id, team.rank]),
    );

    return {
      season,
      week: snapshot.week,
      provisional: true,
      rankings,
    };
  });
}
