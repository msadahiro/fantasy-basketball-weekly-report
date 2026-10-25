import type { TeamStats } from "../rankings/allPlay.js";

export type CategoryOutcome = "home" | "away" | "tie";

export interface CategoryResult {
  key: string;
  label: string;
  homeValue: number;
  awayValue: number;
  outcome: CategoryOutcome;
}

export interface MatchupResult {
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  categories: CategoryResult[];
  homeCategoryWins: number;
  awayCategoryWins: number;
  ties: number;
  winner: "home" | "away" | "tie";
  margin: number;
  kind: "blowout" | "close" | "normal" | "tie";
}

interface CategorySpec {
  key: string;
  label: string;
  value: (team: TeamStats) => number;
  higherWins: boolean;
}

const categorySpecs: CategorySpec[] = [
  {
    key: "fg_pct",
    label: "FG%",
    value: (t) => t.fgm / t.fga,
    higherWins: true,
  },
  {
    key: "ft_pct",
    label: "FT%",
    value: (t) => t.ftm / t.fta,
    higherWins: true,
  },
  { key: "threes", label: "3PM", value: (t) => t.threes, higherWins: true },
  { key: "points", label: "PTS", value: (t) => t.points, higherWins: true },
  { key: "rebounds", label: "REB", value: (t) => t.rebounds, higherWins: true },
  { key: "assists", label: "AST", value: (t) => t.assists, higherWins: true },
  { key: "steals", label: "STL", value: (t) => t.steals, higherWins: true },
  { key: "blocks", label: "BLK", value: (t) => t.blocks, higherWins: true },
  {
    key: "turnovers",
    label: "TO",
    value: (t) => t.turnovers,
    higherWins: false,
  },
];

const BLOWOUT_MARGIN = 5;
const CLOSE_MARGIN = 1;

export function calculateMatchup(
  home: TeamStats,
  away: TeamStats,
): MatchupResult {
  const categories: CategoryResult[] = categorySpecs.map((spec) => {
    const homeValue = spec.value(home);
    const awayValue = spec.value(away);

    let outcome: CategoryOutcome;

    if (homeValue === awayValue) {
      outcome = "tie";
    } else {
      const homeBetter = spec.higherWins
        ? homeValue > awayValue
        : homeValue < awayValue;
      outcome = homeBetter ? "home" : "away";
    }

    return { key: spec.key, label: spec.label, homeValue, awayValue, outcome };
  });

  const homeCategoryWins = categories.filter(
    (c) => c.outcome === "home",
  ).length;
  const awayCategoryWins = categories.filter(
    (c) => c.outcome === "away",
  ).length;
  const ties = categories.filter((c) => c.outcome === "tie").length;

  let winner: "home" | "away" | "tie";

  if (homeCategoryWins > awayCategoryWins) winner = "home";
  else if (awayCategoryWins > homeCategoryWins) winner = "away";
  else winner = "tie";

  const margin = Math.abs(homeCategoryWins - awayCategoryWins);

  let kind: MatchupResult["kind"];

  if (winner === "tie") kind = "tie";
  else if (margin >= BLOWOUT_MARGIN) kind = "blowout";
  else if (margin <= CLOSE_MARGIN) kind = "close";
  else kind = "normal";

  return {
    home: home.name,
    away: away.name,
    homeId: home.id,
    awayId: away.id,
    categories,
    homeCategoryWins,
    awayCategoryWins,
    ties,
    winner,
    margin,
    kind,
  };
}

function formatValue(category: CategoryResult): [string, string] {
  if (category.key === "fg_pct" || category.key === "ft_pct") {
    return [category.homeValue.toFixed(3), category.awayValue.toFixed(3)];
  }
  return [String(category.homeValue), String(category.awayValue)];
}

function categoryList(categories: CategoryResult[], side: "home" | "away") {
  return categories.filter((c) => c.outcome === side).map((c) => c.label);
}

// A short, data-grounded recap. No invented injuries, comebacks or trades.
export function recapMatchup(result: MatchupResult): string {
  const { home, away, homeCategoryWins, awayCategoryWins, ties, kind } = result;

  const score = `${Math.max(homeCategoryWins, awayCategoryWins)}-${Math.min(
    homeCategoryWins,
    awayCategoryWins,
  )}${ties ? `-${ties}` : ""}`;

  if (kind === "tie") {
    return (
      `${home} and ${away} split the week ${homeCategoryWins}-${awayCategoryWins}` +
      `${ties ? ` with ${ties} tied` : ""}. ` +
      "Nobody blinked, nobody bragged."
    );
  }

  const winningSide: "home" | "away" =
    result.winner === "home" ? "home" : "away";
  const winnerName = winningSide === "home" ? home : away;
  const loserName = winningSide === "home" ? away : home;
  const wonCats = categoryList(result.categories, winningSide);

  const decidingCats = wonCats.slice(0, 3).join(", ");

  if (kind === "blowout") {
    if (homeCategoryWins === 9 || awayCategoryWins === 9) {
      return (
        `${winnerName} swept ${loserName} 9-0. ` +
        "Every category. No survivors. That's a factory reset."
      );
    }

    const featured =
      result.categories.find(
        (c) => c.outcome === winningSide && c.key === "points",
      ) ??
      result.categories.find((c) => c.outcome === winningSide)!;

    const [homeStat, awayStat] = formatValue(featured);
    const winnerStat = winningSide === "home" ? homeStat : awayStat;
    const loserStat = winningSide === "home" ? awayStat : homeStat;

    return (
      `${winnerName} routed ${loserName} ${score}. ` +
      `${featured.label}: ${winnerStat} to ${loserStat}. ` +
      "The scoreboard wasn't taking questions."
    );
  }

  if (kind === "close") {
    const swing = result.categories.find((c) => c.outcome === winningSide);
    const [hv, av] = swing ? formatValue(swing) : ["", ""];
    const edge = swing
      ? ` ${swing.label} (${winningSide === "home" ? hv : av} to ${winningSide === "home" ? av : hv})`
      : "";
    return (
      `${winnerName} edged ${loserName} ${score} in a photo finish, ` +
      `with${edge || " every category contested"} standing out. A win is a win.`
    );
  }

  // Highlight a real category won by this matchup's winner.
  // The selection is deterministic, so previews stay reproducible.
  const winningResults = result.categories.filter(
    (category) => category.outcome === winningSide,
  );

  let seed = 5381;

  for (const character of `${result.homeId}|${result.awayId}`) {
    seed = (
      Math.imul(seed, 33) ^
      (character.codePointAt(0) ?? 0)
    ) >>> 0;
  }

  const featured = winningResults[seed % winningResults.length]!;
  const [homeStat, awayStat] = formatValue(featured);

  const winnerStat =
    winningSide === "home" ? homeStat : awayStat;

  const loserStat =
    winningSide === "home" ? awayStat : homeStat;

  const stat = `${winnerStat} to ${loserStat}`;

  const angles: Record<string, string> = {
    fg_pct: `FG% was ${stat}. The rim had a favorite.`,
    ft_pct: `FT% was ${stat}. The charity stripe chose sides.`,
    threes: `Threes finished ${stat}. Long-range receipts attached.`,
    points: `Points finished ${stat}. The scoreboard stayed busy.`,
    rebounds: `Rebounds finished ${stat}. Glass-cleaning service included.`,
    assists: `Assists finished ${stat}. Sharing was apparently caring.`,
    steals: `Steals finished ${stat}. Check your pockets.`,
    blocks: `Blocks finished ${stat}. Entry denied.`,
    turnovers: `Turnovers finished ${stat}. Ball security matters.`,
  };

  const intros = [
    `${winnerName} beat ${loserName} ${score}.`,
    `${loserName} fell ${score} to ${winnerName}.`,
    `${winnerName} took it ${score} against ${loserName}.`,
  ];

  const intro = intros[(seed >>> 8) % intros.length]!;
  return `${intro} ${angles[featured.key]}`;
}
