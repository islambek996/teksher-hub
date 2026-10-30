import test from "node:test";
import assert from "node:assert/strict";
import { calculateManagerAnalytics } from "./manager-analytics.js";

const now = new Date("2026-10-27T12:00:00Z");

test("counts documents, jurisdiction and enabled source monitors", () => {
  const result = calculateManagerAnalytics(
    [
      {
        jurisdiction: "KG",
        status: "ACTIVE",
        sourceUrl: "https://example.kg",
        lastReviewedAt: "2026-10-01",
      },
      {
        jurisdiction: "RU",
        status: "UNDER_REVIEW",
        sourceUrl: "",
        effectiveUntil: "2026-10-01",
      },
      { jurisdiction: "EAEU", statusLabel: "Черновик" },
    ],
    [{ enabled: true }, { enabled: false }, {}],
    now,
  );
  assert.equal(result.total, 3);
  assert.equal(result.awaitingReview, 2);
  assert.equal(result.expired, 1);
  assert.equal(result.missingSource, 2);
  assert.deepEqual(result.byJurisdiction, [
    { code: "KG", count: 1 },
    { code: "RU", count: 1 },
    { code: "EAEU", count: 1 },
  ]);
  assert.equal(result.monitorTotal, 3);
  assert.equal(result.monitorEnabled, 1);
});

test("treats absent and old review dates as follow-up signals", () => {
  const result = calculateManagerAnalytics(
    [
      { lastReviewedAt: "2026-05-01T12:00:00Z" },
      { lastReviewedAt: "2026-04-28T11:59:59Z" },
      { lastReviewedAt: "not-a-date" },
    ],
    [],
    now,
  );
  assert.equal(result.staleReview, 2);
});

test("does not mark today expiry as expired and handles empty monitor input", () => {
  const result = calculateManagerAnalytics(
    [{ effectiveUntil: "2026-10-27" }, { effectiveUntil: "invalid" }],
    null,
    now,
  );
  assert.equal(result.expired, 0);
  assert.equal(result.total, 2);
  assert.equal(result.monitorTotal, 0);
  assert.equal(result.monitorEnabled, 0);
});
