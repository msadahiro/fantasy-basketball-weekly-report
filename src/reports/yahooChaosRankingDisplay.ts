export interface YahooRankingDisplayEntry {
  rank: number;
  team: string;
  movement: number | null;
}

export function formatYahooRankingDisplay(
  entry: YahooRankingDisplayEntry,
  week: number,
  source: "real" | "synthetic",
): string {
  const prefix = `${entry.rank}. ${entry.team}`;

  if (entry.movement === null) {
    return prefix;
  }

  const previousRank = entry.rank + entry.movement;

  if (week === 1) {
    return source === "real"
      ? `${prefix} (Preseason #${previousRank})`
      : prefix;
  }

  return `${prefix} (Last week: #${previousRank})`;
}
