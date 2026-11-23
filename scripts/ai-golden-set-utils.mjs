export function normalizeGoldenAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\p{White_Space}\u200B]/gu, "");
}

export function containsNumericMarkingOrderLimit(value) {
  return /\d{1,6}(?:км|код(?:а|ов)?)/i.test(normalizeGoldenAnswer(value));
}
