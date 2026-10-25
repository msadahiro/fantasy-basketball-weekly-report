const TOKEN_URL =
  "https://api.login.yahoo.com/oauth2/get_token";

type Fetcher = (
  url: string,
  options: RequestInit,
) => Promise<Response>;

export interface YahooOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetcher?: Fetcher;
}

export interface YahooTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function required(value: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Yahoo ${name}`);
  }
}

async function requestTokens(
  config: YahooOAuthConfig,
  fields: Record<string, string>,
  previousRefreshToken?: string,
): Promise<YahooTokens> {
  required(config.clientId, "client ID");
  required(config.clientSecret, "client secret");
  required(config.redirectUri, "redirect URI");

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const response = await (config.fetcher ?? fetch)(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        ...fields,
        redirect_uri: config.redirectUri,
      }).toString(),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );

  // Never include Yahoo's raw response or credentials in errors.
  if (!response.ok) {
    throw new Error(
      `Yahoo OAuth token request failed: HTTP ${response.status}`,
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid Yahoo OAuth token response");
  }

  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data)
  ) {
    throw new Error("Invalid Yahoo OAuth token response");
  }

  const value = data as Record<string, unknown>;

  if (
    typeof value.access_token !== "string" ||
    !value.access_token ||
    typeof value.token_type !== "string" ||
    value.token_type.toLowerCase() !== "bearer" ||
    typeof value.expires_in !== "number" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    throw new Error("Invalid Yahoo OAuth token response");
  }

  const refreshToken =
    typeof value.refresh_token === "string" &&
    value.refresh_token
      ? value.refresh_token
      : previousRefreshToken;

  if (!refreshToken) {
    throw new Error("Missing Yahoo OAuth refresh token");
  }

  return {
    accessToken: value.access_token,
    refreshToken,
    expiresIn: value.expires_in,
  };
}

export function exchangeYahooAuthorizationCode(
  config: YahooOAuthConfig,
  code: string,
): Promise<YahooTokens> {
  required(code, "authorization code");

  return requestTokens(config, {
    grant_type: "authorization_code",
    code,
  });
}

export function refreshYahooAccessToken(
  config: YahooOAuthConfig,
  refreshToken: string,
): Promise<YahooTokens> {
  required(refreshToken, "refresh token");

  return requestTokens(
    config,
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    refreshToken,
  );
}

export class YahooOAuthSession {
  private cached:
    | { accessToken: string; expiresAt: number }
    | null = null;

  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly config: YahooOAuthConfig,
    private refreshToken: string,
    private readonly saveRefreshToken: (
      token: string,
    ) => Promise<void>,
    private readonly now: () => number = Date.now,
  ) {
    required(refreshToken, "refresh token");
  }

  getAccessToken(): Promise<string> {
    // Refresh 60 seconds before expiration.
    if (
      this.cached &&
      this.now() < this.cached.expiresAt - 60000
    ) {
      return Promise.resolve(this.cached.accessToken);
    }

    // Concurrent requests share one token refresh.
    if (!this.inFlight) {
      this.inFlight = this.refresh().finally(() => {
        this.inFlight = null;
      });
    }

    return this.inFlight;
  }

  private async refresh(): Promise<string> {
    const tokens = await refreshYahooAccessToken(
      this.config,
      this.refreshToken,
    );

    if (tokens.refreshToken !== this.refreshToken) {
      // Persist a rotated token before using the new access token.
      await this.saveRefreshToken(tokens.refreshToken);
      this.refreshToken = tokens.refreshToken;
    }

    this.cached = {
      accessToken: tokens.accessToken,
      expiresAt: this.now() + tokens.expiresIn * 1000,
    };

    return tokens.accessToken;
  }
}
