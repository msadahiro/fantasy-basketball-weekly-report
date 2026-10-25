import { parse } from "csv-parse/sync";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { formatMatchupCommentary, type WriterStyle } from "../editorial/sportswriter.js";

const categories = [
  { key: "fg_pct", label: "FG%", higher: true },
  { key: "ft_pct", label: "FT%", higher: true },
  { key: "threes", label: "3PM", higher: true },
  { key: "points", label: "PTS", higher: true },
  { key: "rebounds", label: "REB", higher: true },
  { key: "assists", label: "AST", higher: true },
  { key: "steals", label: "ST", higher: true },
  { key: "blocks", label: "BLK", higher: true },
  { key: "turnovers", label: "TO", higher: false },
] as const;

const headers = ["team", ...categories.map((category) => category.key)];

type CategoryKey = (typeof categories)[number]["key"];
type MatchupTeam = {
  team: string;
} & Record<CategoryKey, number>;

function readTeams(csv: string): MatchupTeam[] {
  const records = parse(csv, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (actual: string[]) => {
      if (
        actual.length !== headers.length ||
        actual.some((value, i) => value !== headers[i])
      ) {
        throw new Error("Unexpected matchup CSV headers");
      }
      return actual;
    },
  }) as Record<string, string>[];

  if (records.length !== 2) {
    throw new Error("Expected exactly two teams");
  }

  const teams = records.map((record) => {
    const team = record.team?.trim();

    if (!team) {
      throw new Error("Missing team name");
    }

    const values = {} as Record<CategoryKey, number>;

    for (const category of categories) {
      const raw = record[category.key];
      const value = Number(raw);

      const percentage = category.key === "fg_pct" || category.key === "ft_pct";

      if (
        raw === undefined ||
        raw.trim() === "" ||
        !Number.isFinite(value) ||
        value < 0 ||
        (percentage && value > 1) ||
        (!percentage && !Number.isSafeInteger(value))
      ) {
        throw new Error(`Invalid ${category.label} for ${team}`);
      }

      values[category.key] = value;
    }

    return { team, ...values };
  });

  if (teams[0]!.team === teams[1]!.team) {
    throw new Error("Matchup teams must be different");
  }

  return teams;
}

export function createProvisionalMatchupReport(
  csv: string,
  week: number,
  style: WriterStyle = "playful",
): string {
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error("Invalid week");
  }

  const [first, second] = readTeams(csv);

  const leads = [0, 0];
  let ties = 0;

  const categoryLines = categories.map((category) => {
    const a = first![category.key];
    const b = second![category.key];

    const difference = category.higher ? a - b : b - a;

    let winner: string;

    if (difference === 0) {
      ties++;
      winner = "Tie";
    } else if (difference > 0) {
      leads[0]++;
      winner = first!.team;
    } else {
      leads[1]++;
      winner = second!.team;
    }

    const display = (value: number) =>
      category.key === "fg_pct" || category.key === "ft_pct"
        ? value.toFixed(3)
        : String(value);

    return `${category.label}: ${display(a)} vs ${display(b)} ` + `— ${winner}`;
  });

  const share = (index: number) =>
    (((leads[index]! + ties * 0.5) / 9) * 100).toFixed(1);

  const commentary = formatMatchupCommentary(
    {
      firstTeam: first!.team,
      secondTeam: second!.team,
      firstLeads: leads[0]!,
      secondLeads: leads[1]!,
      ties,
    },
    style,
  );

  return [
    "🔒 *PRIVATE DRAFT — NOT APPROVED*",
    "⚠️ PROVISIONAL MATCHUP — NOT FINAL",
    "MANUALLY ENTERED — NOT INDEPENDENTLY VERIFIED",
    "",
    "🏀 *LEAGUE OF EXTRAORDINARY MEN*",
    `*WEEK ${week} — MATCHUP SNAPSHOT*`,
    "",
    `*${first!.team}:* ${leads[0]} category leads`,
    `*${second!.team}:* ${leads[1]} category leads`,
    `Tied categories: ${ties}`,
    "",
    "*CATEGORY COMPARISON*",
    ...categoryLines,
    "",
    "*TWO-TEAM CATEGORY SHARE*",
    `${first!.team}: ${share(0)}%`,
    `${second!.team}: ${share(1)}%`,
    "",
    "📰 *SPORTSWRITER*",
    commentary,
    "",
    "FG% and FT% are based on Yahoo's rounded display values.",
    "NOT OFFICIAL LEAGUE-WIDE POWER RANKINGS.",
    "No report has been sent or published.",
  ].join("\n");
}

export async function saveProvisionalMatchupReport(
  content: string,
  week: number,
  directory = "data/private/reports",
): Promise<string> {
  if (!Number.isSafeInteger(week) || week < 1) {
    throw new Error("Invalid week");
  }

  if (
    !content.includes("PRIVATE DRAFT") ||
    !content.includes("PROVISIONAL MATCHUP — NOT FINAL")
  ) {
    throw new Error("Not a provisional private report");
  }

  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  const filepath = path.join(directory, `provisional-week-${week}-matchup.txt`);

  await writeFile(filepath, content, {
    flag: "wx",
    mode: 0o600,
  });

  return filepath;
}
