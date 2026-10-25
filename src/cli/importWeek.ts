import { importManualWeek } from "../data/manualImport.js";

const filepath = process.argv[2];

if (!filepath) {
  throw new Error("Usage: npx tsx src/cli/importWeek.ts <weekly-data.json>");
}

const result = await importManualWeek(filepath);

console.log("\n🏀 LEAGUE OF EXTRAORDINARY MEN");
console.log(`WEEK ${result.week} — MANUAL ALL-PLAY IMPORT`);
console.log("====================================\n");

result.allPlay.forEach((team, index) => {
  const winRate = (team.categoryWinRate * 100).toFixed(1);

  const record = [
    team.categoryWins,
    team.categoryLosses,
    team.categoryTies,
  ].join("-");

  console.log(
    `${String(index + 1).padStart(2)}. ${team.team}` +
      ` | ${winRate}%` +
      ` | ${record} (W-L-T)`,
  );
});

console.log("\nMANUALLY ENTERED DATA — Not independently verified.");
console.log("No report saved or sent.");
