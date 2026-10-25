import { readFileSync } from "node:fs";
import { calculateAllPlay, type TeamStats } from "./allPlay";

interface LeagueTeam {
  name: string;
}

const league: LeagueTeam[] = JSON.parse(
  readFileSync(new URL("../data/sample-league.json", import.meta.url), "utf8"),
);

if (league.length !== 12) {
  throw new Error("Expected exactly 12 league teams.");
}

// Synthetic data for testing only.
// Replace with real Yahoo weekly results later.
const teams: TeamStats[] = league.map((team, i) => ({
  id: `team-${i + 1}`,
  name: team.name,
  fgm: 180 + ((i * 11) % 58),
  fga: 400 + ((i * 17) % 70),
  ftm: 90 + ((i * 7) % 30),
  fta: 120 + ((i * 11) % 40),
  threes: 35 + ((i * 7) % 32),
  points: 520 + ((i * 19) % 120),
  rebounds: 165 + ((i * 23) % 95),
  assists: 95 + ((i * 13) % 75),
  steals: 28 + ((i * 5) % 22),
  blocks: 17 + ((i * 9) % 26),
  turnovers: 45 + ((i * 7) % 37),
}));

const rankings = calculateAllPlay(teams);

console.log("\n🏀 LEAGUE OF EXTRAORDINARY MEN");
console.log("ALL-PLAY POWER RANKINGS — DEMO DATA");
console.log("====================================\n");

rankings.forEach((team, index) => {
  const rank = String(index + 1).padStart(2, " ");
  const winRate = (team.categoryWinRate * 100).toFixed(1);

  console.log(
    `${rank}. ${team.team} — ${winRate}% | ` +
      `${team.categoryWins}-${team.categoryLosses}-${team.categoryTies}`,
  );
});

console.log("\nDEMO ONLY — Statistics are synthetic.");
