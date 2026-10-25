import { readFileSync } from "node:fs";
import type { TeamStats } from "./rankings/allPlay.js";
import type { WeeklySnapshot } from "./rankings/powerRankings.js";
import { calculateRankingHistory } from "./data/history.js";
import { createReportDraft } from "./reports/reportDraft.js";
import { savePrivateDraft } from "./publication/privateDraft.js";
interface DemoTeam {
  name: string;
}

const league = JSON.parse(
  readFileSync(new URL("../data/sample-league.json", import.meta.url), "utf8"),
) as DemoTeam[];

if (league.length !== 12) {
  throw new Error("Demo requires exactly 12 teams.");
}

// Generate three weeks of synthetic basketball statistics.
function makeTeams(week: number): TeamStats[] {
  return league.map((team, i) => {
    const fgm = 180 + ((i * 11 + week * 13) % 58);
    const fga = 400 + ((i * 17 + week * 7) % 70);
    const ftm = 90 + ((i * 7 + week * 3) % 30);
    const fta = 120 + ((i * 11 + week * 5) % 40);
    const threes = 35 + ((i * 7 + week * 11) % 32);

    return {
      id: `demo-team-${i + 1}`,
      name: team.name,
      fgm,
      fga,
      ftm,
      fta,
      threes,
      points: 2 * fgm + threes + ftm,
      rebounds: 165 + ((i * 23 + week * 19) % 95),
      assists: 95 + ((i * 13 + week * 17) % 75),
      steals: 28 + ((i * 5 + week * 7) % 22),
      blocks: 17 + ((i * 9 + week * 5) % 26),
      turnovers: 45 + ((i * 7 + week * 11) % 37),
    };
  });
}

const weeks: WeeklySnapshot[] = [1, 2, 3].map((week) => ({
  week,
  teams: makeTeams(week),
}));

const history = calculateRankingHistory(weeks);
const latest = history.at(-1)!;

console.log("\n🏀 LEAGUE OF EXTRAORDINARY MEN");
console.log(`WEEK ${latest.week} — POWER RANKINGS`);
console.log("====================================\n");

for (const team of latest.rankings) {
  const movement =
    team.movement === null
      ? "NEW"
      : team.movement > 0
        ? `↑${team.movement}`
        : team.movement < 0
          ? `↓${Math.abs(team.movement)}`
          : "—";

  console.log(
    `${String(team.powerRank).padStart(2)}. ${team.team} ` +
      `| Power ${(team.powerScore * 100).toFixed(1)}/100 ` +
      `| All-Play #${team.allPlayRank} ` +
      `| ${movement}`,
  );
}

const risers = latest.rankings.filter((team) => (team.movement ?? 0) > 0);

const fallers = latest.rankings.filter((team) => (team.movement ?? 0) < 0);

const maxRise = Math.max(0, ...risers.map((team) => team.movement!));

const maxFall = Math.max(0, ...fallers.map((team) => -team.movement!));

const biggestRisers = risers.filter((team) => team.movement === maxRise);

const biggestFallers = fallers.filter((team) => team.movement === -maxFall);

console.log("\n🏆 WEEKLY AWARDS");

console.log(
  "Biggest Riser:",
  biggestRisers.length
    ? biggestRisers.map((team) => `${team.team} (↑${maxRise})`).join(", ")
    : "None",
);

console.log(
  "Biggest Fall:",
  biggestFallers.length
    ? biggestFallers.map((team) => `${team.team} (↓${maxFall})`).join(", ")
    : "None",
);

console.log("\nDEMO ONLY — All statistics are synthetic.");

const draft = createReportDraft(latest);

console.log("\n");
console.log(draft.content);

if (process.argv.includes("--save-draft")) {
  const filepath = await savePrivateDraft(draft, latest.week);

  console.log(`\nPrivate draft saved: ${filepath}`);
}
