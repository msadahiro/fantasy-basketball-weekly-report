import assert from "node:assert/strict";
import test from "node:test";

import {
  exchangeYahooAuthorizationCode,
  refreshYahooAccessToken,
  YahooOAuthSession,
  type YahooOAuthConfig,
} from "./yahooOAuth.js";

const responseBody = {
  access_token: "access-one",
  refresh_token: "refresh-two",
  token_type: "bearer",
  expires_in: 3600,
};

function config(
  fetcher: NonNullable<YahooOAuthConfig["fetcher"]>,
): YahooOAuthConfig {
  return {
    clientId: "test-client",
    clientSecret: "test-secret",
    redirectUri: "http://localhost:8080/callback",
    fetcher,
  };
}

function success(
  overrides: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({ ...responseBody, ...overrides }),
    { status: 200 },
  );
}

test("exchanges authorization codes using Yahoo OAuth", async () => {
  let called = false;

  const tokens = await exchangeYahooAuthorizationCode(
    config(async (url, options) => {
      called = true;

      assert.equal(
        url,
        "https://api.login.yahoo.com/oauth2/get_token",
      );
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");

      const headers = options.headers as Record<string, string>;

      assert.equal(
        headers.Authorization,
        "Basic " +
          Buffer.from("test-client:test-secret").toString("base64"),
      );

      const fields = new URLSearchParams(options.body as string);

      assert.equal(fields.get("grant_type"), "authorization_code");
      assert.equal(fields.get("code"), "sample-code");
      assert.equal(
        fields.get("redirect_uri"),
        "http://localhost:8080/callback",
      );

      return success();
    }),
    "sample-code",
  );

  assert.equal(called, true);
  assert.equal(tokens.accessToken, "access-one");
  assert.equal(tokens.refreshToken, "refresh-two");
});

test("refreshes tokens and accepts refresh-token rotation", async () => {
  const tokens = await refreshYahooAccessToken(
    config(async (_url, options) => {
      const fields = new URLSearchParams(options.body as string);

      assert.equal(fields.get("grant_type"), "refresh_token");
      assert.equal(fields.get("refresh_token"), "refresh-one");

      return success();
    }),
    "refresh-one",
  );

  assert.equal(tokens.refreshToken, "refresh-two");
});

test("retains old refresh token when Yahoo omits replacement", async () => {
  const tokens = await refreshYahooAccessToken(
    config(async () =>
      new Response(
        JSON.stringify({
          access_token: "access-one",
          token_type: "bearer",
          expires_in: 3600,
        }),
        { status: 200 },
      )
    ),
    "refresh-one",
  );

  assert.equal(tokens.refreshToken, "refresh-one");
});

test("rejects OAuth errors without leaking response content", async () => {
  const secret = "sensitive-server-response";

  await assert.rejects(
    refreshYahooAccessToken(
      config(async () =>
        new Response(secret, { status: 401 })
      ),
      "refresh-one",
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, /sensitive/);
      return true;
    },
  );
});

test("rejects malformed OAuth token responses", async () => {
  await assert.rejects(
    refreshYahooAccessToken(
      config(async () =>
        success({ expires_in: "not-a-number" })
      ),
      "refresh-one",
    ),
    /Invalid Yahoo OAuth token response/,
  );
});

test("reuses a valid access token and refreshes near expiry", async () => {
  let clock = 0;
  let requests = 0;

  const session = new YahooOAuthSession(
    config(async () => {
      requests++;
      return success({
        access_token: `access-${requests}`,
        refresh_token: "refresh-one",
        expires_in: 120,
      });
    }),
    "refresh-one",
    async () => {},
    () => clock,
  );

  assert.equal(await session.getAccessToken(), "access-1");

  clock = 59000;
  assert.equal(await session.getAccessToken(), "access-1");

  clock = 61000;
  assert.equal(await session.getAccessToken(), "access-2");

  assert.equal(requests, 2);
});

test("shares one refresh across concurrent requests", async () => {
  let requests = 0;

  const session = new YahooOAuthSession(
    config(async () => {
      requests++;
      return success();
    }),
    "refresh-one",
    async () => {},
  );

  const [first, second] = await Promise.all([
    session.getAccessToken(),
    session.getAccessToken(),
  ]);

  assert.equal(first, "access-one");
  assert.equal(second, "access-one");
  assert.equal(requests, 1);
});

test("does not use rotated tokens if persistence fails", async () => {
  const session = new YahooOAuthSession(
    config(async () => success()),
    "refresh-one",
    async () => {
      throw new Error("Secure storage unavailable");
    },
  );

  await assert.rejects(
    session.getAccessToken(),
    /Secure storage unavailable/,
  );
});
