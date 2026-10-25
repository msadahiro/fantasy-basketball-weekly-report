import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWhatsAppEditorial,
} from "./yahooChaosEditorial.js";

test("allows a Power Rankings-only WhatsApp report", () => {
  const report = [
    "THE WEEKLY CHAOS REPORT",
    "PROVISIONAL POWER RANKINGS",
    "1. Team A — 59/100",
    "2. Team B — 54/100",
  ].join("\n");

  assert.doesNotThrow(
    () => assertWhatsAppEditorial(report),
  );
});

test("rejects All-Play references in WhatsApp copy", () => {
  const report = [
    "PROVISIONAL POWER RANKINGS",
    "Team A won weekly All-Play.",
  ].join("\n");

  assert.throws(
    () => assertWhatsAppEditorial(report),
    /must not mention All-Play/,
  );
});

test("rejects reports without a Power Rankings table", () => {
  const report = [
    "THE WEEKLY CHAOS REPORT",
    "The best team dominated this week.",
  ].join("\n");

  assert.throws(
    () => assertWhatsAppEditorial(report),
    /must show Power Rankings/,
  );
});
