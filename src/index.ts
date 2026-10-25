import { readFileSync } from "node:fs";
import { calculateAllPlay, type TeamStats } from "./allPlay";
import { calculatePowerRankings, type WeeklySnapshot } from "./powerRankings";

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

// All-Play: latest week's performance.
const latestAllPlay = calculateAllPlay(weeks[2]!.teams);

// Power Rankings: all three weeks.
const powerRankings = calculatePowerRankings(weeks);

// Previous rankings: weeks one and two.
const previousPower = calculatePowerRankings(weeks.slice(0, 2));

const allPlayById = new Map(
  latestAllPlay.map((team, index) => [
    team.id,
    { rank: index + 1, rate: team.categoryWinRate },
  ]),
);

const previousRankById = new Map(
  previousPower.map((team) => [team.id, team.rank]),
);

console.log("\n🏀 LEAGUE OF EXTRAORDINARY MEN");
console.log("WEEK 3 — POWER RANKINGS");
console.log("====================================\n");

for (const team of powerRankings) {
  const allPlay = allPlayById.get(team.id)!;
  const previousRank = previousRankById.get(team.id)!;
  const movement = previousRank - team.rank;

  const arrow =
    movement > 0
      ? `↑${movement}`
      : movement < 0
        ? `↓${Math.abs(movement)}`
        : "—";

  console.log(
    `${String(team.rank).padStart(2)}. ${team.team} ` +
      `| Power ${(team.powerScore * 100).toFixed(1)}/100 ` +
      `| All-Play #${allPlay.rank} ` +
      `(${(allPlay.rate * 100).toFixed(1)}%) ` +
      `| ${arrow}`,
  );
}

console.log("\nDEMO ONLY — All statistics are synthetic.");
