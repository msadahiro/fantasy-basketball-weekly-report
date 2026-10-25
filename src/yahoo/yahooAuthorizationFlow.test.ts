import assert from "node:assert/strict";
import test from "node:test";

import {
  YahooAuthorizationFlow,
} from "./yahooAuthorizationFlow.js";

const redirect = "http://localhost:8080/callback";

function callback(
  state: string,
  code = "sample-code",
): string {
  const url = new URL(redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("code", code);
  return url.toString();
}

function begin(now?: () => number) {
  const flow = new YahooAuthorizationFlow(
    "test-client",
    redirect,
    now,
  );

  const url = new URL(flow.createAuthorizationUrl());
  const state = url.searchParams.get("state")!;

  return { flow, url, state };
}

test("generates Yahoo authorization URLs with secure state", () => {
  const { url, state } = begin();

  assert.equal(
    url.origin,
    "https://api.login.yahoo.com",
  );

  assert.equal(url.pathname, "/oauth2/request_auth");
  assert.equal(url.searchParams.get("client_id"), "test-client");
  assert.equal(url.searchParams.get("redirect_uri"), redirect);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.ok(state.length >= 40);
});

test("accepts a valid callback only once", () => {
  const { flow, state } = begin();

  assert.equal(
    flow.consumeCallback(callback(state)),
    "sample-code",
  );

  assert.throws(
    () => flow.consumeCallback(callback(state)),
    /No pending Yahoo authorization/,
  );
});

test("rejects an incorrect OAuth state", () => {
  const { flow } = begin();

  assert.throws(
    () => flow.consumeCallback(callback("incorrect-state")),
    /state mismatch/,
  );
});

test("rejects missing or duplicated state parameters", () => {
  const { flow, state } = begin();

  assert.throws(
    () => flow.consumeCallback(
      `${redirect}?code=sample-code`,
    ),
    /Invalid Yahoo OAuth state/,
  );

  assert.throws(
    () => flow.consumeCallback(
      `${callback(state)}&state=${state}`,
    ),
    /Invalid Yahoo OAuth state/,
  );
});

test("rejects callbacks sent to a different URL", () => {
  const { flow, state } = begin();

  assert.throws(
    () => flow.consumeCallback(
      `http://localhost:8080/other?state=${state}&code=abc`,
    ),
    /callback URI mismatch/,
  );
});

test("expires old authorization attempts", () => {
  let clock = 0;
  const { flow, state } = begin(() => clock);

  clock = 11 * 60 * 1000;

  assert.throws(
    () => flow.consumeCallback(callback(state)),
    /authorization expired/,
  );
});

test("handles authorization denial without exposing details", () => {
  const { flow, state } = begin();

  const url = new URL(redirect);
  url.searchParams.set("state", state);
  url.searchParams.set("error", "access_denied");

  assert.throws(
    () => flow.consumeCallback(url.toString()),
    /authorization denied or failed/,
  );
});

test("rejects invalid redirect URIs and missing codes", () => {
  assert.throws(
    () => new YahooAuthorizationFlow(
      "test-client",
      "http://example.com/callback",
    ),
    /Invalid Yahoo redirect URI/,
  );

  const { flow, state } = begin();

  assert.throws(
    () => flow.consumeCallback(
      `${redirect}?state=${state}`,
    ),
    /Missing or invalid Yahoo authorization code/,
  );
});
