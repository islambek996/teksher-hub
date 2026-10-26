#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixturePath = path.join(repoRoot, "backend/src/test/resources/ai-golden-set.json");
const reportPath = path.join(repoRoot, "backend/target/ai-golden-results.json");
const baseUrl = (process.env.TEKSHER_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const token = process.env.TEKSHER_API_TOKEN || "";

if (!token) {
  console.error("TEKSHER_API_TOKEN is required. Supply a temporary bearer token for a test account.");
  process.exit(2);
}

const cases = JSON.parse(await readFile(fixturePath, "utf8"));
const validCitationPattern = /\[(\d{1,2})\]/g;
const staleStatuses = new Set(["DRAFT", "UNDER_REVIEW", "EXPIRED", "ARCHIVED"]);
const officialHosts = {
  KG: ["cbd.minjust.gov.kg", "minjust.gov.kg", "gov.kg", "teksher.kg"],
  RU: ["publication.pravo.gov.ru", "pravo.gov.ru", "government.ru", "xn--80ajghhoc2aj1c8b.xn--p1ai", "docs.crpt.ru"],
  EAEU: ["eec.eaeunion.org", "docs.eaeunion.org"]
};

function isHostIn(host, allowedHosts) {
  return allowedHosts.some(allowed => host === allowed || host.endsWith("." + allowed));
}

function isOfficialWebEvidence(source, jurisdiction) {
  if (source?.sourceType !== "WEB" || !officialHosts[jurisdiction]) return false;
  try {
    const url = new URL(source.sourceUrl);
    return url.protocol === "https:" && isHostIn(url.hostname.toLowerCase(), officialHosts[jurisdiction]);
  } catch {
    return false;
  }
}

function hasInsufficientEvidenceLanguage(answer) {
  const text = String(answer || "").toLowerCase().replaceAll("ё", "е");
  return [
    "не нашлось материалов", "не подтверждено", "недостаточно данных",
    "недостаточно информации", "не удалось найти", "нет подтверждения",
    "не указано в источниках", "информация отсутствует", "маалымат жетишсиз"
  ].some(phrase => text.includes(phrase));
}

async function evaluateCase(item, index) {
  let response;
  let responseText = "";
  try {
    response = await fetch(baseUrl + "/api/ai/ask", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ question: item.question, history: [] }),
      signal: AbortSignal.timeout(75_000)
    });
    responseText = await response.text();
  } catch (error) {
    return {
      id: item.id,
      question: item.question,
      expectedJurisdiction: item.expectedJurisdiction,
      automatedPass: false,
      error: String(error)
    };
  }

  if (!response.ok) {
    return {
      id: item.id,
      question: item.question,
      expectedJurisdiction: item.expectedJurisdiction,
      automatedPass: false,
      httpStatus: response.status,
      error: responseText.slice(0, 2_000)
    };
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    return {
      id: item.id,
      question: item.question,
      expectedJurisdiction: item.expectedJurisdiction,
      automatedPass: false,
      error: "The API returned a non-JSON response",
      responseText: responseText.slice(0, 2_000)
    };
  }

  const answer = typeof data.answer === "string" ? data.answer : "";
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const availableNumbers = new Set(sources.map(source => Number(source.number)).filter(Number.isFinite));
  const citedNumbers = [...answer.matchAll(validCitationPattern)].map(match => Number(match[1]));
  const invalidCitations = citedNumbers.filter(number => !availableNumbers.has(number));
  const citationGuardWarning = answer.includes("не удалось сопоставить с найденными материалами");
  const answerExplicitlyAbstains = hasInsufficientEvidenceLanguage(answer);
  const noCitationButConfident = !answerExplicitlyAbstains && citedNumbers.length === 0;
  const documentSources = sources.filter(source => source.sourceType === "DOCUMENT");
  const flaggedDocumentSources = documentSources.filter(source => staleStatuses.has(String(source.status || "").toUpperCase()));
  const requiresStatusWarning = flaggedDocumentSources.length > 0;
  const statusWarningPresent = answer.includes("среди найденных материалов есть документы со статусом");
  const today = new Date().toISOString().slice(0, 10);
  const activeDateConflicts = documentSources.filter(source => {
    if (String(source.status || "").toUpperCase() !== "ACTIVE") return false;
    const from = source.effectiveFrom || null;
    const until = source.effectiveUntil || null;
    return (from && (!/^\\d{4}-\\d{2}-\\d{2}$/.test(from) || from > today)) ||
      (until && (!/^\\d{4}-\\d{2}-\\d{2}$/.test(until) || until < today));
  });
  const dateWarningPresent = answer.includes("указанный период дат не покрывает текущую дату");

  let matchedJurisdictionSources = [];
  let jurisdictionMismatch = false;
  if (item.expectedJurisdiction && item.expectedJurisdiction !== "NONE") {
    matchedJurisdictionSources = sources.filter(source =>
      (source.sourceType === "DOCUMENT" &&
        String(source.jurisdiction || "").toUpperCase() === item.expectedJurisdiction) ||
      isOfficialWebEvidence(source, item.expectedJurisdiction)
    );
    jurisdictionMismatch = matchedJurisdictionSources.length === 0 &&
      !(data.insufficientEvidence && hasInsufficientEvidenceLanguage(answer));
  }

  const checks = {
    validResponseSchema: Boolean(answer) && Array.isArray(sources) && typeof data.insufficientEvidence === "boolean",
    citationNumbersMapToReturnedSources: invalidCitations.length === 0 && !citationGuardWarning,
    noConfidentAnswerWithoutCitation: !noCitationButConfident,
    statusWarningWhenUsingUnreviewedOrArchivedDocuments: !requiresStatusWarning || statusWarningPresent,
    dateWarningWhenActiveDocumentDatesConflict: activeDateConflicts.length === 0 || dateWarningPresent,
    jurisdictionHasSupportingSourceOrAssistantAbstains: !jurisdictionMismatch,
    insufficientEvidenceFlagConsistentWithFallback: !(hasInsufficientEvidenceLanguage(answer) && data.insufficientEvidence === false)
  };

  return {
    id: item.id,
    question: item.question,
    expectedJurisdiction: item.expectedJurisdiction,
    expectedFacts: item.expectedFacts,
    forbiddenClaims: item.forbiddenClaims,
    reviewCriterion: item.reviewCriterion,
    primaryOfficialReference: item.primaryOfficialReference,
    operationalReference: item.operationalReference || null,
    operationalReferenceStatus: item.operationalReferenceStatus || null,
    operationalReferenceNote: item.operationalReferenceNote || null,
    answer,
    insufficientEvidence: data.insufficientEvidence,
    sources: sources.map(source => ({
      number: source.number,
      type: source.sourceType,
      title: source.title,
      jurisdiction: source.jurisdiction,
      status: source.status,
      statusLabel: source.statusLabel,
      effectiveFrom: source.effectiveFrom,
      effectiveUntil: source.effectiveUntil,
      excerpt: source.excerpt,
      sourceUrl: source.sourceUrl
    })),
    automatedChecks: checks,
    automatedPass: Object.values(checks).every(Boolean),
    manualFactReviewRequired: true,
    debug: {
      citedNumbers,
      invalidCitations,
      flaggedDocumentSources: flaggedDocumentSources.map(source => source.title),
      activeDateConflicts: activeDateConflicts.map(source => source.title),
      matchingJurisdictionSources: matchedJurisdictionSources.map(source => source.title)
    }
  };
}

console.log("TEKSHER HUB AI golden-set evaluation");
console.log("Base URL:", baseUrl);
console.log("Cases:", cases.length);
console.log("Note: automated checks do not replace a reviewer comparing each answer with the cited legal text.");

const results = [];
for (let index = 0; index < cases.length; index++) {
  const item = cases[index];
  const result = await evaluateCase(item, index);
  results.push(result);
  const state = result.automatedPass ? "PASS" : "FAIL";
  console.log(`[${state}] ${index + 1}/${cases.length} ${item.id}`);
  if (result.error) console.log("  Error:", result.error);
  if (result.automatedChecks) {
    for (const [name, passed] of Object.entries(result.automatedChecks)) {
      if (!passed) console.log("  Failed check:", name);
    }
  }
  if (result.answer) console.log("  Answer preview:", result.answer.replace(/\s+/g, " ").slice(0, 240));
  console.log("  Sources:", result.sources?.length ?? 0);
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  total: results.length,
  passed: results.filter(result => result.automatedPass).length,
  failed: results.filter(result => !result.automatedPass).length,
  manualFactReviewRequired: true,
  note: "Each answer must still be compared with expectedFacts, forbiddenClaims, reviewCriterion and the actual source text.",
  results
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(`Report written to ${reportPath}`);
console.log(`Summary: ${summary.passed}/${summary.total} automated checks passed`);
if (summary.failed > 0) process.exit(1);
