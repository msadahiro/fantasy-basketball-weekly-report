import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAIReportWordCount,
} from "./yahooChaosEditorial.js";

test("accepts reports within the target range", () => {
  for (const words of [350, 370, 427, 450]) {
    assert.doesNotThrow(() => {
      assertAIReportWordCount(words);
    });
  }
});

test("rejects reports outside the target range", () => {
  for (const words of [0, 349, 451, 600, NaN]) {
    assert.throws(
      () => assertAIReportWordCount(words),
      /required range is 350-450/,
    );
  }
});
