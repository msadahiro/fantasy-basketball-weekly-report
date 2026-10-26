// Applied after participant team names have been removed.
// This prevents ordinary team-name wordplay from triggering the guard.
export function assertNoCategoryRecap(text: string): void {
  const forbiddenFraming =
    /\b(?:category|categories|box[\s-]?score)\b/i;

  if (forbiddenFraming.test(text)) {
    throw new Error("AI matchup story contains category narration");
  }

  const statNames =
    /\b(?:points?|rebounds?|assists?|steals?|blocks?|turnovers?|threes?|three[- ]pointers?|field goals?|free throws?)\b/gi;

  const mentioned = new Set(
    [...text.matchAll(statNames)]
      .map((match) => match[0]!.toLowerCase()),
  );

  // Listing multiple statistical categories is a recap, not a roast.
  if (mentioned.size >= 2) {
    throw new Error("AI matchup story contains category narration");
  }

  // Even one category becomes a recap when presented as the result.
  const statisticalAdvantage =
    /\b(?:won|wins?|winning|led|leads?|dominated|controlled|owned|swept)\s+(?:(?:the|in|on|at)\s+)?(?:points?|rebounds?|assists?|steals?|blocks?|turnovers?|threes?|three[- ]pointers?|field goals?|free throws?)\b/i;

  if (
    statisticalAdvantage.test(text) ||
    /(?:\bFG%|\bFT%|\b3PM\b)/i.test(text)
  ) {
    throw new Error("AI matchup story contains category narration");
  }
}
