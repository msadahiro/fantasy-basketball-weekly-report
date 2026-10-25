export interface LeagueConfig {
  id: string;
  displayName: string;
  provider: "yahoo";
  defaultPlatform: "whatsapp";
  defaultDestinationId: string;
}

export const DEFAULT_LEAGUE_ID =
  "league-of-extraordinary-men";

const leagues: Readonly<Record<string, LeagueConfig>> = {
  [DEFAULT_LEAGUE_ID]: {
    id: DEFAULT_LEAGUE_ID,
    displayName: "LEAGUE OF EXTRAORDINARY MEN",
    provider: "yahoo",
    defaultPlatform: "whatsapp",
    defaultDestinationId: "main-league-chat",
  },
};

export function getLeagueConfig(
  leagueId: string,
): LeagueConfig {
  if (!Object.hasOwn(leagues, leagueId)) {
    throw new Error(`Unknown league ID: ${leagueId}`);
  }

  return leagues[leagueId]!;
}
