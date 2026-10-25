import type { HistoricalRanking, WeeklyRankingHistory } from "./history.js";
import { detectStorylines, type Storyline } from "./storylines.js";
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

function formatStoryline(story: Storyline): string {
  const weeklyRank = story.allPlayRank;
  const powerRank = story.powerRank;
  const movement = story.movement ?? 0;

  switch (story.kind) {
    case "biggest_riser":
      return (
        `🚀 *The Climb — ${story.team}*\n` +
        `Up ${movement} spots to #${powerRank} in the Power Rankings. ` +
        `A #${weeklyRank} weekly All-Play finish gives this team something to celebrate.`
      );

    case "biggest_fall":
      return (
        `📉 *The Freefall — ${story.team}*\n` +
        `Down ${Math.abs(movement)} spots to #${powerRank}. ` +
        `Their weekly All-Play finish was #${weeklyRank}.`
      );

    case "weekly_overperformer":
      return (
        `🔥 *Above Expectations — ${story.team}*\n` +
        `Power ranked #${powerRank}, but finished #${weeklyRank} in weekly All-Play. ` +
        `That's ${powerRank - weeklyRank} places above their overall ranking.`
      );

    case "weekly_underperformer":
      return (
        `🥶 *A Rough Week — ${story.team}*\n` +
        `Power ranked #${powerRank}, but finished #${weeklyRank} in weekly All-Play. ` +
        `That's ${weeklyRank - powerRank} places below their overall ranking.`
      );
  }
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
  );

  // Detect and select up to four distinct teams.
  const selectedStories: Storyline[] = [];
  const featuredTeams = new Set<string>();

  for (const story of detectStorylines(snapshot)) {
    if (featuredTeams.has(story.teamId)) continue;

    selectedStories.push(story);
    featuredTeams.add(story.teamId);

    if (selectedStories.length === 4) break;
  }

  if (selectedStories.length > 0) {
    lines.push("📰 *WEEKLY STORYLINES*", "");

    for (const story of selectedStories) {
      lines.push(formatStoryline(story), "");
    }
  }

  lines.push(
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
