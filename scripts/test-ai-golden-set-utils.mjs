import assert from "node:assert/strict";
import {
  containsNumericMarkingOrderLimit,
  normalizeGoldenAnswer,
} from "./ai-golden-set-utils.mjs";

const variants = [
  "5 000 кодов",
  "5\u00a0000 кодов",
  "5\u202f000 кодов",
  "5\u200b000 кодов",
];

for (const value of variants) {
  assert.equal(normalizeGoldenAnswer(value), "5000кодов");
  assert.equal(containsNumericMarkingOrderLimit(value), true);
}

assert.equal(containsNumericMarkingOrderLimit("Лимит не подтверждён"), false);
assert.equal(containsNumericMarkingOrderLimit("Номер документа 1944"), false);

console.log("Golden Set Unicode numeric-limit checks passed.");
