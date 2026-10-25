const BASE_URL =
  "https://fantasysports.yahooapis.com/fantasy/v2";

type Fetcher = (
  url: string,
  options: RequestInit,
) => Promise<Response>;

export interface YahooApiClientOptions {
  getAccessToken: () => string | Promise<string>;
  fetcher?: Fetcher;
}

function validateLeagueKey(key: string): void {
  if (!/^[a-zA-Z0-9]+\.l\.[0-9]+$/.test(key)) {
    throw new Error("Invalid Yahoo league key");
  }
}

function validateWeek(week: number): void {
  if (!Number.isInteger(week) || week < 1) {
    throw new Error("Invalid Yahoo matchup week");
  }
}

export class YahooApiClient {
  private readonly getAccessToken: YahooApiClientOptions["getAccessToken"];
  private readonly fetcher: Fetcher;

  constructor(options: YahooApiClientOptions) {
    this.getAccessToken = options.getAccessToken;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async getXml(path: string): Promise<string> {
    const token = await this.getAccessToken();

    if (typeof token !== "string" || !token.trim()) {
      throw new Error("Missing Yahoo OAuth access token");
    }

    const response = await this.fetcher(
      `${BASE_URL}${path}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/xml",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Yahoo OAuth token is invalid or expired");
      }
      if (response.status === 403) {
        throw new Error("Yahoo Fantasy API access denied");
      }
      if (response.status === 429) {
        throw new Error("Yahoo API rate limit reached");
      }

      throw new Error(
        `Yahoo API request failed: HTTP ${response.status}`,
      );
    }

    const body = await response.text();

    if (
      !/^\s*(?:<\?xml[^>]*\?>\s*)?<fantasy_content(?:\s|>)/.test(
        body,
      )
    ) {
      throw new Error("Unexpected Yahoo Fantasy API response");
    }

    return body;
  }

  getMyLeagues(): Promise<string> {
    return this.getXml(
      "/users;use_login=1/games/leagues",
    );
  }

  getSeasonGames(season: number): Promise<string> {
    if (
      !Number.isInteger(season) ||
      season < 2000 ||
      season > 2100
    ) {
      throw new Error("Invalid Yahoo fantasy season");
    }

    return this.getXml(
      `/games;game_codes=nba;seasons=${season}`,
    );
  }

  getGameWeeks(gameKey: string): Promise<string> {
    if (!/^[0-9]+$/.test(gameKey)) {
      throw new Error("Invalid Yahoo game key");
    }

    return this.getXml(
      `/game/${gameKey}/game_weeks`,
    );
  }

  getLeagueMetadata(leagueKey: string): Promise<string> {
    validateLeagueKey(leagueKey);

    return this.getXml(
      `/league/${leagueKey}/metadata`,
    );
  }

  getLeagueTeams(leagueKey: string): Promise<string> {
    validateLeagueKey(leagueKey);

    return this.getXml(
      `/league/${leagueKey}/teams`,
    );
  }

  getLeagueScoreboard(
    leagueKey: string,
    week: number,
  ): Promise<string> {
    validateLeagueKey(leagueKey);
    validateWeek(week);

    return this.getXml(
      `/league/${leagueKey}/scoreboard;week=${week}`,
    );
  }
}
