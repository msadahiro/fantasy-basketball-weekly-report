import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rewriteMatchupCommentary } from "../editorial/aiMatchupWriter.js";
import {
  assignEditorialStyles,
  STYLE_GUIDANCE,
} from "../editorial/editorialStyles.js";

import {
  rewriteBigPicture,
  createOpenAITextGenerator,
} from "../editorial/aiChaosWriter.js";

import { parseYahooMatchupCsv } from "../yahoo/yahooMatchupCsv.js";
import { calculateDisplayedAllPlay } from "../rankings/yahooDisplayedAllPlay.js";
import { loadMatchupPairings } from "../data/matchupPairings.js";
import { countWords } from "../reports/weeklyShow.js";
import { saveYahooChaosDraft } from "../reports/yahooChaosSave.js";
import { calculateYahooRankingHistory } from "../rankings/yahooPowerRankings.js";
import { assertWhatsAppEditorial, assertAIReportWordCount } from "../editorial/yahooChaosEditorial.js";
import { loadApprovedYahooStoryHistory } from "../editorial/yahooStoryHistory.js";
import { loadPublishedYahooStoryHistory } from "../editorial/publishedYahooStoryHistory.js";
import { buildWeekOnePreseasonRecap } from "../preseason/preseasonNarrative.js";
import { assertReadyYahooPeriodManifest } from "../yahoo/yahooPeriodManifest.js";
import {
  parsePreseasonRankings,
  calculatePreseasonMovements,
} from "../preseason/preseasonRankings.js";

import {
  DEFAULT_LEAGUE_ID,
  getLeagueConfig,
} from "../config/leagueConfig.js";

const league = getLeagueConfig(DEFAULT_LEAGUE_ID);
import { buildYahooStoryCallback } from "../editorial/yahooStoryContinuity.js";

const [csvPath, pairingsPath, source, ...options] = process.argv.slice(2);

let save = false;
let saveRevision = false;
let ai = false;
let previousPaths: string[] | null = null;
let periodsPath: string | null = null;
let exportEditorialPath: string | null = null;
let importEditorialPath: string | null = null;
let draftDirectory: string | null = null;

for (let i = 0; i < options.length; i++) {
  if (options[i] === "--save") {
    if (save || saveRevision) {
      throw new Error("Choose one save mode");
    }
    save = true;
  } else if (options[i] === "--save-revision") {
    if (save || saveRevision) {
      throw new Error("Choose one save mode");
    }
    saveRevision = true;
  } else if (options[i] === "--ai") {
    ai = true;
  } else if (options[i] === "--export-editorial") {
    if (exportEditorialPath !== null) {
      throw new Error("Duplicate --export-editorial");
    }

    const value = options[++i];

    if (!value || value.startsWith("--")) {
      throw new Error("--export-editorial requires a JSON file path");
    }

    exportEditorialPath = value;
  } else if (options[i] === "--import-editorial") {
    if (importEditorialPath !== null) {
      throw new Error("Duplicate --import-editorial");
    }

    const value = options[++i];

    if (!value || value.startsWith("--")) {
      throw new Error("--import-editorial requires a JSON file path");
    }

    importEditorialPath = value;
  } else if (options[i] === "--draft-dir") {
    if (draftDirectory !== null) {
      throw new Error("Duplicate --draft-dir");
    }

    const value = options[++i];

    if (!value || value.startsWith("--")) {
      throw new Error("--draft-dir requires a directory");
    }

    draftDirectory = value;
  } else if (options[i] === "--periods") {
    if (periodsPath !== null) {
      throw new Error("Duplicate --periods");
    }

    const value = options[++i];

    if (!value || value.startsWith("--")) {
      throw new Error("--periods requires a JSON file path");
    }

    periodsPath = value;
  } else if (options[i] === "--previous") {
    if (previousPaths !== null) {
      throw new Error("Duplicate --previous");
    }

    const value = options[++i];
    if (!value || value.startsWith("--")) {
      throw new Error("--previous requires comma-separated CSV paths");
    }

    previousPaths = value.split(",");
    if (previousPaths.some((filepath) => !filepath)) {
      throw new Error("Empty previous-week CSV path");
    }
  } else {
    throw new Error(`Unknown option: ${options[i]}`);
  }
}

if (
  exportEditorialPath !== null &&
  (ai || save || saveRevision)
) {
  throw new Error(
    "--export-editorial cannot be combined with --ai or save modes"
  );
}

if (
  !csvPath ||
  !pairingsPath ||
  (source !== "synthetic" && source !== "real")
) {
  throw new Error(
    "Usage: npx tsx src/cli/previewYahooChaos.ts " +
    "<yahoo.csv> <pairings.json> synthetic|real " +
    "[--previous w1.csv,w2.csv] [--periods manifest.json] [--save|--save-revision] [--ai] [--export-editorial path.json] [--import-editorial response.json] [--draft-dir directory]"
  );
}

if (
  importEditorialPath !== null &&
  (ai || exportEditorialPath !== null)
) {
  throw new Error(
    "--import-editorial cannot be combined with --ai, export, or save modes"
  );
}

if (
  draftDirectory !== null &&
  !save &&
  !saveRevision
) {
  throw new Error("--draft-dir requires --save or --save-revision");
}

const editorialMode = ai || importEditorialPath !== null;

const pairings = loadMatchupPairings(pairingsPath);

const week = parseYahooMatchupCsv(
  readFileSync(csvPath, "utf8"),
  pairings.season,
  pairings.week,
);

const result = calculateDisplayedAllPlay(week, pairings);

const previousFiles = previousPaths ?? [];

if (previousFiles.length !== week.week - 1) {
  throw new Error(
    `Week ${week.week} requires ${week.week - 1} previous CSV files ` +
    "for accurate Power Rankings.",
  );
}

if (source === "real") {
  if (!periodsPath) {
    throw new Error(
      "Real Yahoo reports require --periods with verified final results",
    );
  }

  const manifest: unknown = JSON.parse(
    readFileSync(periodsPath, "utf8"),
  );

  assertReadyYahooPeriodManifest(manifest, {
    leagueId: league.id,
    season: week.season,
    week: week.week,
  });
} else if (periodsPath !== null) {
  throw new Error(
    "--periods is only used for real Yahoo reports",
  );
}

const powerHistory = calculateYahooRankingHistory([
  ...previousFiles.map((filepath, index) =>
    parseYahooMatchupCsv(
      readFileSync(filepath, "utf8"),
      week.season,
      index + 1,
    )
  ),
  week,
]);

const calculatedPower = powerHistory.at(-1)!;

const preseasonMovements =
  source === "real" && week.week === 1
    ? calculatePreseasonMovements(
        parsePreseasonRankings(
          readFileSync(
            `data/private/preseason/${week.season}-${league.id}.json`,
            "utf8",
          ),
          league.id,
          week.season,
        ),
        week.teams,
        calculatedPower.rankings,
      )
    : null;

const power = {
  ...calculatedPower,
  rankings: preseasonMovements
    ? calculatedPower.rankings.map((team) => ({
        ...team,
        movement: preseasonMovements.get(team.id)!,
      }))
    : calculatedPower.rankings,
};

const approvedStories = source === "synthetic"
  ? await loadApprovedYahooStoryHistory({
      season: week.season,
      beforeWeek: week.week,
      source,
    })
  : await loadPublishedYahooStoryHistory({
      leagueId: league.id,
      season: week.season,
      beforeWeek: week.week,
    });

const preseasonRecap =
  source === "real" && week.week === 1 && preseasonMovements
    ? buildWeekOnePreseasonRecap(
        power.rankings,
        preseasonMovements,
      )
    : null;

const continuity = buildYahooStoryCallback(
  approvedStories,
  powerHistory.at(-2)?.rankings ?? null,
  power.rankings,
  week.week,
);

const byId = new Map(
  week.teams.map((team) => [team.id, team]),
);

const categories = [
  { key: "fg_pct", label: "FG%", joke: "The rim had a favorite." },
  { key: "ft_pct", label: "FT%", joke: "The charity stripe chose sides." },
  { key: "threes", label: "3PM", joke: "Long-range receipts delivered." },
  { key: "points", label: "PTS", joke: "The scoreboard did the talking." },
  { key: "rebounds", label: "REB", joke: "Glass-cleaning service included." },
  { key: "assists", label: "AST", joke: "Sharing apparently is caring." },
  { key: "steals", label: "STL", joke: "Check the lost-and-found." },
  { key: "blocks", label: "BLK", joke: "Entry to the paint denied." },
  { key: "turnovers", label: "TO", joke: "Ball security wins friends." },
] as const;

function leaderName(
  matchup: (typeof result.matchups)[number],
): string | null {
  if (matchup.homeWins === matchup.awayWins) return null;

  return matchup.homeWins > matchup.awayWins
    ? matchup.home
    : matchup.away;
}

function recap(
  matchup: (typeof result.matchups)[number],
  index: number,
): string {
  const [homeId, awayId] = pairings.pairings[index]!;
  const home = byId.get(homeId)!;
  const away = byId.get(awayId)!;

  const leaderHome = matchup.homeWins > matchup.awayWins;
  const leaderAway = matchup.awayWins > matchup.homeWins;
  const leader = leaderName(matchup);

  const score =
    `${matchup.homeWins}-${matchup.awayWins}` +
    (matchup.ties ? `-${matchup.ties}` : "");

  const uncertainty = matchup.uncertain
    ? ` (${matchup.uncertain} unresolved)`
    : "";

  const winningStats = categories.filter((category) => {
    const a = home[category.key];
    const b = away[category.key];

    if (a === b) return false;

    const homeBetter =
      category.key === "turnovers" ? a < b : a > b;

    return (
      (leaderHome && homeBetter) ||
      (leaderAway && !homeBetter)
    );
  });

  const featured = winningStats.length
    ? winningStats[index % winningStats.length]
    : undefined;

  const detail = featured
    ? `${featured.label} ${featured.key.endsWith("_pct")
        ? home[featured.key].toFixed(3)
        : home[featured.key]}-${featured.key.endsWith("_pct")
        ? away[featured.key].toFixed(3)
        : away[featured.key]}. ${featured.joke}`
    : "The category scoreboard is evenly split.";

  const outcome = leader
    ? `The category edge goes to ${leader}.`
    : "Neither side has a category lead.";

  return (
    `• ${matchup.home} ${score}${uncertainty} ${matchup.away}. ` +
    `${outcome} ${detail}`
  );
}

const ordered = [...result.rankings];

const decided = [...result.matchups].filter(
  (matchup) => matchup.homeWins !== matchup.awayWins,
);

const byMargin = [...decided].sort(
  (a, b) =>
    Math.abs(b.homeWins - b.awayWins) -
    Math.abs(a.homeWins - a.awayWins),
);

const biggest = byMargin[0];
const closest = byMargin.at(-1);

const biggestLeader = biggest ? leaderName(biggest) : null;
const closestLeader = closest ? leaderName(closest) : null;

const bottom = ordered.at(-1)!;

const rankings = power.rankings.map((team) => {
  const movement = team.movement === null
    ? "NEW"
    : team.movement > 0
      ? `⬆️${team.movement}`
      : team.movement < 0
        ? `⬇️${Math.abs(team.movement)}`
        : "➖";

  return (
    `${team.rank}. ${team.team} ${movement} — ` +
    `${(team.powerScore * 100).toFixed(1)}/100`
  );
});

const awards: string[] = [];

if (biggest && biggestLeader) {
  awards.push(
    `🧹 *Steamroller:* ${biggestLeader} — ` +
    `${Math.max(biggest.homeWins, biggest.awayWins)} ` +
    "category leads in the widest matchup."
  );
}

if (
  closest &&
  closestLeader &&
  closestLeader !== biggestLeader &&
  Math.abs(closest.homeWins - closest.awayWins) <= 2
) {
  awards.push(
    `🎩 *Escape Artist:* ${closestLeader} — ` +
    `${Math.max(closest.homeWins, closest.awayWins)}-` +
    `${Math.min(closest.homeWins, closest.awayWins)} ` +
    "in the closest decided matchup."
  );
}

awards.push(
  `🧊 *Rough Week:* ${bottom.name} — ` +
  `a difficult week across the box score.`
);

const riser = power?.rankings
  .filter((team) => (team.movement ?? 0) > 0)
  .sort((a, b) => b.movement! - a.movement!)[0];

const faller = power?.rankings
  .filter((team) => (team.movement ?? 0) < 0)
  .sort((a, b) => a.movement! - b.movement!)[0];

const movementStories = [
  riser
    ? `🚀 *The Climb:* ${riser.team} rose ${riser.movement} spots to #${riser.rank}.`
    : null,
  faller
    ? `📉 *The Freefall:* ${faller.team} dropped ${Math.abs(faller.movement!)} spots to #${faller.rank}.`
    : null,
].filter((line): line is string => line !== null);

function editorialRecap(
  matchup: (typeof result.matchups)[number],
  index: number,
): string {
  const [homeId, awayId] = pairings.pairings[index]!;
  const home = byId.get(homeId)!;
  const away = byId.get(awayId)!;
  const leader = leaderName(matchup);
  const margin = Math.abs(matchup.homeWins - matchup.awayWins);

  let story: string;

  if (matchup.uncertain > 0) {
    story = "Some categories remain unresolved. The newsroom is withholding its victory parade until the evidence improves.";
  } else if (!leader) {
    story = "Neither side has a clear advantage. The league's department of decisive outcomes remains unavailable for comment.";
  } else if (margin <= 1) {
    story = `${leader} holds a narrow lead. Even the box scores appear nervous about how this one develops.`;
  } else if (margin >= 5) {
    const reactions = [
      `${leader} leads comfortably. Competitive balance has requested a private meeting with league officials.`,
      `${leader} is dominating this matchup. The opposition's public relations department has declined to comment.`,
      `${leader} has built a commanding advantage. The newsroom is investigating whether mercy was ever considered.`,
    ];
    story = reactions[index % reactions.length]!;
  } else {
    story = `${leader} has the upper hand, although the newsroom has postponed any premature victory celebrations.`;
  }

  return `• *${home.name} vs ${away.name}* — ${story}`;
}

const lines = [
  "🔒 *PRIVATE DRAFT — NOT APPROVED*",
  source === "synthetic"
    ? "🧪 DEMO ONLY — Synthetic statistics"
    : "⚠️ MANUAL YAHOO DATA — PROVISIONAL YAHOO DISPLAY — NOT INDEPENDENTLY VERIFIED",
  "",
  "🏀 *THE WEEKLY CHAOS REPORT*",
  `*${league.displayName} — WEEK ${week.week}*`,
  biggestLeader
    ? `_${biggestLeader.toUpperCase()} IN THE SPOTLIGHT_`
    : "_THE LEAGUE REFUSES TO PICK A SIDE_",
  "",
  editorialMode
    ? "Six matchups. Twelve teams. Countless receipts."
    : "Six matchups, twelve teams, and a week of chaos. " +
      "The Power Rankings reflect sustained results and recent momentum. " +
      "Here are the biggest wins, surprises, and receipts.",
  "",
  "⚔️ *MATCHUP MADNESS*",
  ...result.matchups.map(editorialRecap),
  "",
  "📊 *PROVISIONAL POWER RANKINGS*",
  source === "real" && week.week === 1
    ? "_Power Score /100 · movement vs preseason_"
    : week.week === 1
      ? "_Power Score /100 · first-week baseline_"
      : "_Power Score /100 · movement from last week_",
  ...rankings,
  "",
  "🏆 *THE CHAOS AWARDS*",
  ...awards,
  "",
  "📰 *THE BIG PICTURE*",
  continuity ??
  preseasonRecap ??
    (`The #1 Power Ranking belongs to ${power.rankings[0]!.team} at ` +
    `${(power.rankings[0]!.powerScore * 100).toFixed(1)}/100, ` +
    `while ${power.rankings.at(-1)!.team} faces the climb from #12. ` +
    `The rest of the league has work to do. ` +
    `Some teams are building momentum, while others are running ` +
    `out of explanations. Every week brings new pressure.`),
  ...movementStories,
  "",
  "🔮 *NEXT WEEK'S DRAMA*",
  `Can ${power.rankings[0]!.team} defend the #1 ranking? ` +
  `Can ${bottom.name} answer the critics? ` +
  (editorialMode
    ? "Nobody escapes the receipts. 🫡"
    : "One strong week can change the conversation. " +
      "Check the box scores, enjoy the chaos, and keep the receipts. 🫡"),
  "",
  "⚠️ Power Rankings are provisional until Yahoo data is fully verified.",
  source === "synthetic"
    ? "DEMO ONLY — Nothing sent to WhatsApp."
    : "PROVISIONAL — Not approved or sent to WhatsApp.",
];

const baseReport = lines.join("\n");

// Bind editorial writing to the exact deterministic facts.
const factsHash = createHash("sha256")
  .update(JSON.stringify({
    leagueId: league.id,
    season: week.season,
    week: week.week,
    source,
    teams: week.teams.map((team) => ({
      id: team.id,
      name: team.name,
      stats: categories.map((category) => [
        category.key,
        team[category.key],
      ]),
    })),
    matchups: result.matchups.map((matchup, index) => ({
      pairing: pairings.pairings[index],
      homeWins: matchup.homeWins,
      awayWins: matchup.awayWins,
      ties: matchup.ties,
      uncertain: matchup.uncertain,
      verifiedRecap: recap(matchup, index),
    })),
    rankings,
    awards,
  }))
  .digest("hex");

if (exportEditorialPath !== null) {
  const assignments = assignEditorialStyles({
    leagueId: league.id,
    season: week.season,
    week: week.week,
    teamIds: week.teams.map((team) => team.id),
  });

  const packet = {
    schemaVersion: 1,
    kind: "weekly-chaos-editorial-packet",
    leagueId: league.id,
    season: week.season,
    week: week.week,
    source,
    status: "PRIVATE DRAFT - PROVISIONAL",
    factsHash,
    teams: week.teams.map((team) => ({
      id: team.id,
      name: team.name,
      editorialStyle: assignments[team.id],
      styleGuidance: STYLE_GUIDANCE[assignments[team.id]!],
    })),
    matchups: result.matchups.map((matchup, index) => {
      const [homeId, awayId] = pairings.pairings[index]!;
      const homeTeam = byId.get(homeId)!;
      const awayTeam = byId.get(awayId)!;

      return {
        matchup: index + 1,
        homeId,
        awayId,
        homeName: homeTeam.name,
        awayName: awayTeam.name,
        homeWins: matchup.homeWins,
        awayWins: matchup.awayWins,
        ties: matchup.ties,
        uncertain: matchup.uncertain,
        categoryComparisons: categories.map((category) => {
          const homeValue = homeTeam[category.key];
          const awayValue = awayTeam[category.key];
          const percentage = category.key.endsWith("_pct");

          const homeBetter = category.key === "turnovers"
            ? homeValue < awayValue
            : homeValue > awayValue;

          const leader = homeValue === awayValue
            ? percentage
              ? "unresolved"
              : "tie"
            : homeBetter
              ? "home"
              : "away";

          return {
            key: category.key,
            label: category.label,
            homeValue: percentage
              ? homeValue.toFixed(3)
              : String(homeValue),
            awayValue: percentage
              ? awayValue.toFixed(3)
              : String(awayValue),
            leader,
          };
        }),
        verifiedRecap: recap(matchup, index),
      };
    }),
    rankings,
    awards,
    report: baseReport,
  };

  writeFileSync(
    exportEditorialPath,
    JSON.stringify(packet, null, 2) + "\n",
    { flag: "wx" },
  );

  console.log(
    `Editorial packet written: ${exportEditorialPath}`
  );

  process.exit(0);
}
let report = baseReport;

if (editorialMode) {
  const generate = importEditorialPath === null
    ? createOpenAITextGenerator()
    : (() => {
        const imported = JSON.parse(
          readFileSync(importEditorialPath, "utf8"),
        ) as {
          schemaVersion?: unknown;
          kind?: unknown;
          leagueId?: unknown;
          season?: unknown;
          week?: unknown;
          source?: unknown;
          factsHash?: unknown;
          stories?: unknown;
          bigPicture?: unknown;
        };

        if (
          imported.schemaVersion !== 1 ||
          imported.kind !== "weekly-chaos-editorial-response" ||
          imported.leagueId !== league.id ||
          imported.season !== week.season ||
          imported.week !== week.week ||
          imported.source !== source ||
          imported.factsHash !== factsHash
        ) {
          throw new Error(
            "Editorial response does not match this verified report"
          );
        }

        if (
          !Array.isArray(imported.stories) ||
          imported.stories.length !== 6 ||
          typeof imported.bigPicture !== "string"
        ) {
          throw new Error(
            "Editorial response requires six stories and a Big Picture"
          );
        }

        const responses = [
          JSON.stringify({ stories: imported.stories }),
          imported.bigPicture,
        ];

        let call = 0;

        return async (_prompt: string): Promise<string> => {
          if (call >= responses.length) {
            throw new Error("Unexpected editorial generation request");
          }

          return responses[call++]!;
        };
      })();

  const editorialTeams = week.teams.map((team) => ({
    id: team.id,
    name: team.name,
  }));

  report = await rewriteMatchupCommentary(
    {
      leagueId: league.id,
      season: week.season,
      week: week.week,
      teams: editorialTeams,
      matchups: result.matchups.map((matchup, index) => {
        const [homeId, awayId] = pairings.pairings[index]!;

        return {
          homeId,
          awayId,
          homeWins: matchup.homeWins,
          awayWins: matchup.awayWins,
          ties: matchup.ties,
          uncertain: matchup.uncertain,
          verifiedRecap: recap(matchup, index),
        };
      }),
      report,
    },
    generate,
  );

  report = await rewriteBigPicture(
    {
      leagueId: league.id,
      season: week.season,
      week: week.week,
      teams: editorialTeams,
      report,
    },
    generate,
  );
}

assertWhatsAppEditorial(report);
const words = countWords(report);

if (editorialMode) {
  assertAIReportWordCount(words);
}

console.log("\n========== YAHOO CHAOS PREVIEW ==========\n");
console.log(report);
console.log(`\n(${words} words)`);
console.log("\n=========================================");
if (save || saveRevision) {
  const filepath = await saveYahooChaosDraft(
    report,
    week.season,
    week.week,
    source,
    draftDirectory ?? "data/private/reports",
    saveRevision,
  );

  console.log(`Saved private draft: ${filepath}`);
  console.log(
    `Review with: npx tsx src/reports/reviewWeeklyShow.ts ${filepath}`
  );
  console.log("Not approved or published.");
} else {
  console.log("Not saved. Pass --save to create a private draft.");
}
