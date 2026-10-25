import assert from "node:assert/strict";
import test from "node:test";

import {
  YahooKeychainStore,
  type KeychainEntryFactory,
} from "./yahooKeychain.js";

import { YahooOAuthSession } from "./yahooOAuth.js";

function fakeKeychain() {
  const records = new Map<string, string>();

  const factory: KeychainEntryFactory = (service, account) => {
    const key = `${service}:${account}`;

    return {
      getPassword: () => records.get(key) ?? null,
      setPassword: (value) => {
        records.set(key, value);
      },
    };
  };

  return { records, factory };
}

test("stores Yahoo credentials separately", () => {
  const { factory } = fakeKeychain();
  const store = new YahooKeychainStore("league-one", factory);

  store.write("client-secret", "client-secret-value");
  store.write("refresh-token", "refresh-token-value");

  assert.equal(
    store.read("client-secret"),
    "client-secret-value",
  );

  assert.equal(
    store.read("refresh-token"),
    "refresh-token-value",
  );
});

test("isolates credentials between league scopes", () => {
  const { factory } = fakeKeychain();

  const first = new YahooKeychainStore("league-one", factory);
  const second = new YahooKeychainStore("league-two", factory);

  first.write("refresh-token", "first-token");
  second.write("refresh-token", "second-token");

  assert.equal(first.read("refresh-token"), "first-token");
  assert.equal(second.read("refresh-token"), "second-token");
});

test("rejects missing credentials", () => {
  const { factory } = fakeKeychain();
  const store = new YahooKeychainStore("league-one", factory);

  assert.throws(
    () => store.read("refresh-token"),
    /unavailable in secure credential storage/,
  );
});

test("rejects empty credentials and invalid scopes", () => {
  const { factory } = fakeKeychain();
  const store = new YahooKeychainStore("league-one", factory);

  assert.throws(
    () => store.write("refresh-token", ""),
    /Cannot store an empty Yahoo credential/,
  );

  assert.throws(
    () => new YahooKeychainStore("../other", factory),
    /Invalid Yahoo credential scope/,
  );
});

test("does not leak sensitive native errors", () => {
  const store = new YahooKeychainStore(
    "league-one",
    () => ({
      getPassword: () => {
        throw new Error("SECRET-IN-NATIVE-ERROR");
      },
      setPassword: () => {
        throw new Error("SECRET-IN-NATIVE-ERROR");
      },
    }),
  );

  assert.throws(
    () => store.read("refresh-token"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /SECRET-IN-NATIVE-ERROR/);
      return true;
    },
  );

  assert.throws(
    () => store.write("refresh-token", "test-token"),
    /Failed to securely store Yahoo refresh-token/,
  );
});

test("persists a rotated token from an OAuth session", async () => {
  const { factory } = fakeKeychain();
  const store = new YahooKeychainStore("league-one", factory);

  store.write("refresh-token", "original-token");

  const session = new YahooOAuthSession(
    {
      clientId: "test-client",
      clientSecret: "test-secret",
      redirectUri: "http://localhost:8080/callback",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "rotated-token",
            token_type: "bearer",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
    },
    store.read("refresh-token"),
    store.saveRefreshToken,
  );

  assert.equal(
    await session.getAccessToken(),
    "access-token",
  );

  assert.equal(
    store.read("refresh-token"),
    "rotated-token",
  );
});
