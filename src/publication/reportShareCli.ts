import type {
  SharePlatform,
  ShareRequest,
} from "./reportPublication.js";

const platforms: readonly SharePlatform[] = [
  "whatsapp",
  "discord",
  "slack",
  "email",
];

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseReportShareArgs(
  args: readonly string[],
): ShareRequest {
  if (args.length !== 5) {
    throw new Error(
      "Expected five arguments: " +
      "REPORT_PATH LEAGUE_ID REPORT_ID PLATFORM DESTINATION_ID",
    );
  }

  const [
    draftPath,
    leagueId,
    reportId,
    platform,
    destinationId,
  ] = args;

  if (!draftPath?.trim()) {
    throw new Error("A report file path is required");
  }

  for (const [name, value] of [
    ["leagueId", leagueId],
    ["reportId", reportId],
    ["destinationId", destinationId],
  ] as const) {
    if (!value || !slugPattern.test(value)) {
      throw new Error(
        `${name} must be a lowercase, hyphenated identifier`,
      );
    }
  }

  if (
    !platform ||
    !platforms.includes(platform as SharePlatform)
  ) {
    throw new Error(
      `Unsupported platform: ${platform ?? "missing"}`,
    );
  }

  return {
    draftPath,
    leagueId: leagueId!,
    reportId: reportId!,
    platform: platform as SharePlatform,
    destinationId: destinationId!,
  };
}
