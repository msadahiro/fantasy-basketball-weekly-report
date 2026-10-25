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
