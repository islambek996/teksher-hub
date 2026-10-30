const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_AGE_MS = 180 * DAY_MS;

function timestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function statusText(document) {
  return String(
    document?.statusLabel || document?.status || "",
  ).toLocaleLowerCase("ru-RU");
}

export function calculateManagerAnalytics(
  documents = [],
  monitors = [],
  now = new Date(),
) {
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const rows = Array.isArray(documents) ? documents : [];
  const sources = Array.isArray(monitors) ? monitors : [];
  const byJurisdiction = ["KG", "RU", "EAEU"].map((code) => ({
    code,
    count: rows.filter((doc) => doc?.jurisdiction === code).length,
  }));
  return {
    total: rows.length,
    awaitingReview: rows.filter((doc) =>
      /на проверке|under_review|черновик|draft/.test(statusText(doc)),
    ).length,
    expired: rows.filter((doc) => {
      const end = timestamp(doc?.effectiveUntil);
      return end !== null && end < today;
    }).length,
    missingSource: rows.filter((doc) => !String(doc?.sourceUrl || "").trim())
      .length,
    staleReview: rows.filter((doc) => {
      const checked = timestamp(
        doc?.lastReviewedAt || doc?.lastSourceCheckedAt || doc?.reviewedAt,
      );
      return checked === null || now.getTime() - checked > REVIEW_AGE_MS;
    }).length,
    byJurisdiction,
    monitorTotal: sources.length,
    monitorEnabled: sources.filter((item) => item?.enabled === true).length,
  };
}
