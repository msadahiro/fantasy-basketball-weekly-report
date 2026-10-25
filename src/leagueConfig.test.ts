import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LEAGUE_ID,
  getLeagueConfig,
} from "./leagueConfig.js";

test("loads the configured fantasy league", () => {
  const league = getLeagueConfig(DEFAULT_LEAGUE_ID);

  assert.equal(
    league.displayName,
    "LEAGUE OF EXTRAORDINARY MEN",
  );
  assert.equal(league.provider, "yahoo");
  assert.equal(league.defaultPlatform, "whatsapp");
  assert.equal(
    league.defaultDestinationId,
    "main-league-chat",
  );
});

test("rejects unknown league identifiers", () => {
  assert.throws(
    () => getLeagueConfig("unknown-league"),
    /Unknown league ID/,
  );
});
