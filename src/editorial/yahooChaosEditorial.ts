export function assertWhatsAppEditorial(report: string): void {
  if (/\ball[\s-]?play\b/i.test(report)) {
    throw new Error(
      "WhatsApp reports must not mention All-Play. " +
      "Keep the calculation in private analytics.",
    );
  }

  if (!report.includes("PROVISIONAL POWER RANKINGS")) {
    throw new Error(
      "WhatsApp reports must show Power Rankings, " +
      "not a weekly-only leaderboard.",
    );
  }
}

export function assertAIReportWordCount(words: number): void {
  if (
    !Number.isInteger(words) ||
    words < 350 ||
    words > 450
  ) {
    throw new Error(
      `AI report has ${words} words; required range is 350-450. ` +
      "Revise the draft before saving.",
    );
  }
}

// Validate an already-published WhatsApp article.
// This does not grant approval or publication permission.
export function assertPublishedWhatsAppEditorial(report: string): void {
  if (/\ball[\s-]?play\b/i.test(report)) {
    throw new Error("Published reports must not mention All-Play");
  }

  if (!/^📊 \*(?:PROVISIONAL )?POWER RANKINGS\*$/m.test(report)) {
    throw new Error("Published report is missing Power Rankings");
  }
}
