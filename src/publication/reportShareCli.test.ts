import assert from "node:assert/strict";
import test from "node:test";

import {
  parseReportShareArgs,
} from "./reportShareCli.js";

const valid = [
  "data/private/reports/example.txt",
  "league-of-extraordinary-men",
  "2026-week-3",
  "whatsapp",
  "main-league-chat",
];

test("parses platform-neutral sharing arguments", () => {
  const request = parseReportShareArgs(valid);

  assert.equal(
    request.leagueId,
    "league-of-extraordinary-men",
  );
  assert.equal(request.reportId, "2026-week-3");
  assert.equal(request.platform, "whatsapp");
  assert.equal(request.destinationId, "main-league-chat");
});

test("requires exactly five arguments", () => {
  assert.throws(
    () => parseReportShareArgs([]),
    /Expected five arguments/,
  );

  assert.throws(
    () => parseReportShareArgs([...valid, "extra"]),
    /Expected five arguments/,
  );
});

test("rejects unknown platform names", () => {
  assert.throws(
    () => parseReportShareArgs([
      ...valid.slice(0, 3),
      "twitter",
      valid[4]!,
    ]),
    /Unsupported platform/,
  );
});

test("rejects malformed league and destination identifiers", () => {
  assert.throws(
    () => parseReportShareArgs([
      valid[0]!,
      "Another League",
      ...valid.slice(2),
    ]),
    /leagueId/,
  );

  assert.throws(
    () => parseReportShareArgs([
      ...valid.slice(0, 4),
      "Main Chat!",
    ]),
    /destinationId/,
  );
});
