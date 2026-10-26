import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoCategoryRecap,
} from "./matchupStoryVoice.js";

test("rejects a list of statistical categories", () => {
  assert.throws(
    () => assertNoCategoryRecap(
      "They dominated points, rebounds, and assists.",
    ),
    /category narration/,
  );
});

test("rejects a single category presented as a result", () => {
  assert.throws(
    () => assertNoCategoryRecap("They won the rebounds."),
    /category narration/,
  );
});

test("rejects generic category and box-score narration", () => {
  for (const text of [
    "They won more categories.",
    "The box score tells the story.",
    "They led in FG%.",
  ]) {
    assert.throws(
      () => assertNoCategoryRecap(text),
      /category narration/,
    );
  }
});

test("allows playful jokes without statistical recitation", () => {
  for (const text of [
    "The robot has developed the confidence of a crypto founder.",
    "The castle is holding an estate sale.",
    "There is no point pretending this was part of the plan.",
    "Someone should block the robot from giving interviews.",
  ]) {
    assert.doesNotThrow(() => assertNoCategoryRecap(text));
  }
});
