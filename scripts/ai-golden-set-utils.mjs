export function normalizeGoldenAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/(?<=[0-9])[,.](?=[0-9]{3}(?:\\D|$))/g, "")
    .replace(/[\p{White_Space}\u200B]/gu, "");
}

export function containsNumericMarkingOrderLimit(value) {
  const normalized = normalizeGoldenAnswer(value).replace(
    /([0-9])[,.](?=[0-9]{3}(?:\D|$))/g,
    "$1",
  );
  return /(?:\d{1,6}(?:тыс\.?|тысяч(?:а|и)?)?|(?:один|одна|два|две|три|четыре|пять|пяти|шесть|семь|восемь|девять)(?:тыс\.?|тысяч(?:а|и)?))(?:км|код(?:а|ов)?)/i.test(
    normalized,
  );
}
