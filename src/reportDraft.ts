import type { HistoricalRanking, WeeklyRankingHistory } from "./history.js";

export interface ReportDraft {
  status: "draft";
  source: "synthetic";
  content: string;
}

function formatMovement(movement: number | null): string {
  if (movement === null) return "NEW";
  if (movement > 0) return `⬆️ ${movement}`;
  if (movement < 0) return `⬇️ ${Math.abs(movement)}`;
  return "➖";
}

function formatAward(teams: HistoricalRanking[], movement: number): string {
  if (teams.length === 0) return "None";

  return teams
    .map((team) => `${team.team} (${Math.abs(movement)} spots)`)
    .join(", ");
}

export function createReportDraft(snapshot: WeeklyRankingHistory): ReportDraft {
  const rankings = [...snapshot.rankings].sort(
    (a, b) => a.powerRank - b.powerRank,
  );

  if (
    !Number.isInteger(snapshot.week) ||
    snapshot.week < 1 ||
    rankings.length !== 12 ||
    new Set(rankings.map((team) => team.id)).size !== 12 ||
    rankings.some(
      (team, index) =>
        team.powerRank !== index + 1 ||
        !Number.isFinite(team.powerScore) ||
        team.powerScore < 0 ||
        team.powerScore > 1 ||
        !Number.isFinite(team.weeklyCategoryWinRate) ||
        team.weeklyCategoryWinRate < 0 ||
        team.weeklyCategoryWinRate > 1,
    )
  ) {
    throw new Error("Invalid weekly ranking snapshot");
  }

  const movements = rankings.map((team) => team.movement ?? 0);

  const maxRise = Math.max(0, ...movements);
  const maxFall = Math.min(0, ...movements);

  const risers = rankings.filter(
    (team) => maxRise > 0 && team.movement === maxRise,
  );

  const fallers = rankings.filter(
    (team) => maxFall < 0 && team.movement === maxFall,
  );

  const lines: string[] = [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "🧪 DEMO ONLY — Synthetic statistics",
    "",
    "🏀 *LEAGUE OF EXTRAORDINARY MEN*",
    `*WEEK ${snapshot.week} — POWER RANKINGS*`,
    "",
  ];

  for (const team of rankings) {
    lines.push(
      `*${team.powerRank}. ${team.team}* ${formatMovement(team.movement)}`,
      `Power: ${(team.powerScore * 100).toFixed(1)}/100 | ` +
        `All-Play: #${team.allPlayRank} ` +
        `(${(team.weeklyCategoryWinRate * 100).toFixed(1)}%)`,
      "",
    );
  }

  lines.push(
    "🏆 *WEEKLY AWARDS*",
    "",
    `🚀 Biggest Riser: ${formatAward(risers, maxRise)}`,
    `📉 Biggest Fall: ${formatAward(fallers, maxFall)}`,
    "",
    "Power Rankings reflect season-long and recent All-Play performance.",
    "",
    "DEMO ONLY — Nothing has been sent to WhatsApp.",
  );

  return {
    status: "draft",
    source: "synthetic",
    content: lines.join("\n"),
  };
}
