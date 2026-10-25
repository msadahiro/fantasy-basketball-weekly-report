import assert from "node:assert/strict";
import test from "node:test";

import { YahooApiClient } from "./yahooApiClient.js";

const XML =
  '<?xml version="1.0"?><fantasy_content></fantasy_content>';

function mockClient(
  requests: string[],
  status = 200,
  body = XML,
): YahooApiClient {
  return new YahooApiClient({
    getAccessToken: () => "test-token",
    fetcher: async (url, options) => {
      requests.push(url);

      assert.equal(options.method, "GET");
      assert.equal(
        (options.headers as Record<string, string>)
          .Authorization,
        "Bearer test-token",
      );
      assert.equal(options.redirect, "error");

      return new Response(body, { status });
    },
  });
}

test("reads league metadata with OAuth", async () => {
  const requests: string[] = [];
  const client = mockClient(requests);

  assert.equal(
    await client.getLeagueMetadata("123.l.456"),
    XML,
  );

  assert.equal(
    requests[0],
    "https://fantasysports.yahooapis.com/fantasy/v2/" +
      "league/123.l.456/metadata",
  );
});

test("reads teams and official weekly scoreboard", async () => {
  const requests: string[] = [];
  const client = mockClient(requests);

  await client.getLeagueTeams("123.l.456");
  await client.getLeagueScoreboard("123.l.456", 7);

  assert.match(requests[0]!, /\/teams$/);
  assert.match(requests[1]!, /scoreboard;week=7$/);
});

test("reads season games and game-week schedules", async () => {
  const requests: string[] = [];
  const client = mockClient(requests);

  await client.getSeasonGames(2027);
  await client.getGameWeeks("123");

  assert.match(
    requests[0]!,
    /games;game_codes=nba;seasons=2027$/,
  );
  assert.match(requests[1]!, /game\/123\/game_weeks$/);
});

test("discovers leagues for the authorized user", async () => {
  const requests: string[] = [];
  const client = mockClient(requests);

  await client.getMyLeagues();

  assert.match(
    requests[0]!,
    /users;use_login=1\/games\/leagues$/,
  );
});

test("rejects invalid league keys and weeks", async () => {
  const client = mockClient([]);

  assert.throws(
    () => client.getLeagueTeams("https://example.com"),
    /Invalid Yahoo league key/,
  );

  assert.throws(
    () => client.getLeagueScoreboard("123.l.456", 0),
    /Invalid Yahoo matchup week/,
  );

  assert.throws(
    () => client.getGameWeeks("../bad"),
    /Invalid Yahoo game key/,
  );
});

test("refuses to make requests without an OAuth token", async () => {
  const client = new YahooApiClient({
    getAccessToken: () => "",
    fetcher: async () => {
      throw new Error("Network should not be called");
    },
  });

  await assert.rejects(
    client.getMyLeagues(),
    /Missing Yahoo OAuth access token/,
  );
});

test("handles authorization failures and rate limits", async () => {
  for (const [status, message] of [
    [401, /expired/],
    [403, /access denied/],
    [429, /rate limit/],
  ] as const) {
    const client = mockClient([], status);

    await assert.rejects(
      client.getMyLeagues(),
      message,
    );
  }
});

test("rejects unexpected non-XML responses", async () => {
  const client = mockClient(
    [],
    200,
    "<html>Sign in</html>",
  );

  await assert.rejects(
    client.getMyLeagues(),
    /Unexpected Yahoo Fantasy API response/,
  );
});
