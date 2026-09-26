import type {
  ClinicalScorecardData,
  ReportEnrichmentSession,
  ScorecardCriterion,
} from "../types";
import {
  buildCanonicalScorecardPhrase,
  reportAlreadyCoversScorecardCriterion,
} from "./reportEnrichment";

export type ReportQaIssueSeverity = "block" | "warn";

export type ReportQaIssueCode =
  | "empty_impression"
  | "laterality_mismatch"
  | "category_without_recommendation"
  | "scorecard_text_mismatch"
  | "pending_enrichment";

export interface ReportQaIssue {
  id: string;
  code: ReportQaIssueCode;
  severity: ReportQaIssueSeverity;
  title: string;
  detail: string;
  fixHint?: string;
}

export interface ReportQaGateInput {
  reportText: string;
  laterality?: string;
  studyType?: string;
  scorecard?: ClinicalScorecardData | null;
  enrichmentSession?: ReportEnrichmentSession | null;
}

export interface ReportQaGateResult {
  issues: ReportQaIssue[];
  blocks: ReportQaIssue[];
  warnings: ReportQaIssue[];
  hasBlocks: boolean;
  hasWarnings: boolean;
  ok: boolean;
}

function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[\s#\-*]+/, "")
    .replace(/[*_:]/g, "")
    .trim();
}

const SECTION_BOUNDARY_HEADERS = [
  "tipo de estudio",
  "estudio",
  "historia clinica",
  "indicaciones",
  "tecnica del examen",
  "tecnica",
  "hallazgos",
  "hallazgos principales",
  "resultados",
  "impresion diagnostica",
  "impresiones diagnosticas",
  "impresion",
  "conclusion",
  "conclusiones",
  "diagnostico",
  "diagnosticos",
  "resumen operacional de hallazgos",
  "resumen operacional",
  "resumen ejecutivo",
  "resumen de hallazgos",
  "resumen",
  "fdo",
  "medico",
  "firma",
];

const IMPRESSION_HEADERS = [
  "impresion diagnostica",
  "impresiones diagnosticas",
  "impresion",
  "conclusion",
  "conclusiones",
  "diagnostico",
  "diagnosticos",
];

/** Extract impression / conclusion body from a Spanish radiology report. */
export function extractImpressionSection(reportText: string): string {
  if (!reportText) return "";
  const lines = reportText.split("\n");

  for (const key of IMPRESSION_HEADERS) {
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const norm = normalizeHeader(lines[i]);
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + ":")) {
        startIndex = i;
        break;
      }
    }
    if (startIndex === -1) continue;

    const sectionLines: string[] = [];
    for (let j = startIndex + 1; j < lines.length; j++) {
      const normCurrent = normalizeHeader(lines[j]);
      const isBoundary = SECTION_BOUNDARY_HEADERS.some((h) => {
        if (normCurrent === h) return true;
        if (normCurrent.startsWith(h + " ") || normCurrent.startsWith(h + ":")) return true;
        return false;
      });
      if (isBoundary) break;
      sectionLines.push(lines[j]);
    }

    const extracted = sectionLines.join("\n").trim();
    if (extracted && extracted.replace(/[\s\-#*:.]/g, "").length > 0) {
      return extracted;
    }
  }
  return "";
}

export function isEmptyImpression(reportText: string): boolean {
  const raw = extractImpressionSection(reportText);
  if (!raw) return true;
  const n = normalizeForMatch(raw);
  if (n.length < 8) return true;
  if (
    /^(pendiente|n a|na|none|sin impresion|sin conclusion|por completar|tbd|xxx)+$/.test(
      n.replace(/\s+/g, " ")
    )
  ) {
    return true;
  }
  return false;
}

export type LateralitySide = "derecha" | "izquierda" | "bilateral" | "";

export function normalizeLateralitySide(raw: string): LateralitySide {
  const n = normalizeForMatch(raw);
  if (!n) return "";
  if (/\bbilateral\b|\bamb[oa]s\b|\blados\b/.test(n)) return "bilateral";
  if (/\bizquierd|\bizq\b|\bleft\b/.test(n)) return "izquierda";
  if (/\bderech|\bder\b|\bright\b/.test(n)) return "derecha";
  return "";
}

function countSideMentions(text: string): { derecha: number; izquierda: number; bilateral: number } {
  const n = normalizeForMatch(text);
  const derecha = (n.match(/\bderech(?:a|o|as|os)?\b|\bder\b|\bright\b/g) || []).length;
  const izquierda = (n.match(/\bizquierd(?:a|o|as|os)?\b|\bizq\b|\bleft\b/g) || []).length;
  const bilateral = (n.match(/\bbilateral\b|\bamb[oa]s\b/g) || []).length;
  return { derecha, izquierda, bilateral };
}

/**
 * Detect clear laterality contradictions between UI selection / study type and report prose.
 * Only flags strong conflicts (not mere omission).
 */
export function detectLateralityMismatch(
  reportText: string,
  laterality?: string,
  studyType?: string
): { mismatch: boolean; detail: string } | null {
  const uiSide =
    normalizeLateralitySide(laterality || "") ||
    normalizeLateralitySide(studyType || "");
  if (!uiSide || uiSide === "bilateral") return null;

  const impression = extractImpressionSection(reportText) || reportText;
  const counts = countSideMentions(impression);
  const opposite: LateralitySide = uiSide === "derecha" ? "izquierda" : "derecha";
  const sameCount = counts[uiSide];
  const oppCount = counts[opposite];

  // Opposite side dominates in impression/body while declared side is scarce
  if (oppCount >= 2 && oppCount > sameCount) {
    return {
      mismatch: true,
      detail: `El estudio está marcado como ${uiSide}, pero el texto menciona predominantemente ${opposite} (${oppCount} vs ${sameCount}).`,
    };
  }

  // Study-type line inside report contradicts UI laterality
  const studyLineMatch = reportText
    .split("\n")
    .slice(0, 12)
    .map((l) => normalizeForMatch(l))
    .find((l) => l.includes("tipo de estudio") || l.startsWith("estudio"));
  if (studyLineMatch) {
    const lineSide = normalizeLateralitySide(studyLineMatch);
    if (lineSide && lineSide !== "bilateral" && lineSide !== uiSide) {
      return {
        mismatch: true,
        detail: `Lateralidad UI «${uiSide}» vs encabezado del informe «${lineSide}».`,
      };
    }
  }

  return null;
}

function categoryWithoutRecommendation(
  scorecard: ClinicalScorecardData | null | undefined
): ReportQaIssue | null {
  if (!scorecard) return null;
  const category = String(scorecard.categoryAssigned || "").trim();
  if (!category || category.length < 2) return null;
  const reco = String(scorecard.recommendation || "").trim();
  if (reco.length >= 8) return null;
  return {
    id: "qa-cat-reco",
    code: "category_without_recommendation",
    severity: "warn",
    title: "Categoría sin recomendación",
    detail: `Scorecard asignó «${category}» sin recomendación de seguimiento/acción.`,
    fixHint: "Complete la recomendación del protocolo o incorpórela en la impresión.",
  };
}

function scorecardTextMismatches(
  reportText: string,
  scorecard: ClinicalScorecardData | null | undefined,
  max = 3
): ReportQaIssue[] {
  if (!scorecard?.criteria?.length || !reportText) return [];
  const issues: ReportQaIssue[] = [];
  const candidates = scorecard.criteria
    .filter(
      (c: ScorecardCriterion) =>
        (c.status === "met" || c.status === "equivocal") &&
        (c.weight === "critical" || c.weight === "major")
    )
    .slice()
    .sort((a, b) => {
      const wa = a.weight === "critical" ? 0 : 1;
      const wb = b.weight === "critical" ? 0 : 1;
      return wa - wb || (b.severity || 0) - (a.severity || 0);
    });

  for (const c of candidates) {
    if (issues.length >= max) break;
    const phrase = buildCanonicalScorecardPhrase(c);
    if (reportAlreadyCoversScorecardCriterion(reportText, c, phrase)) continue;
    const label = String(c.atlasStructure || c.criterion || "criterio").trim();
    issues.push({
      id: `qa-sc-${c.id || issues.length}`,
      code: "scorecard_text_mismatch",
      severity: "warn",
      title: "Scorecard ↔ texto",
      detail: `Criterio ${c.weight} «${label}» (${c.status}) no se refleja claramente en el informe.`,
      fixHint: phrase.slice(0, 160),
    });
  }
  return issues;
}

function pendingEnrichmentIssues(
  session: ReportEnrichmentSession | null | undefined
): ReportQaIssue | null {
  if (!session?.changes?.length) return null;
  const pending = session.changes.filter((c) => c.status === "pending");
  if (pending.length === 0) return null;
  return {
    id: "qa-pending-enrich",
    code: "pending_enrichment",
    severity: "warn",
    title: "Pulido clínico pendiente",
    detail: `${pending.length} cambio${pending.length === 1 ? "" : "s"} de pulido aún pendiente${pending.length === 1 ? "" : "s"} de aplicar o descartar.`,
    fixHint: "Revise el panel Pulido clínico antes de firmar el PDF.",
  };
}

/** Run the hard pre-PDF QA checklist. */
export function runReportQaGate(input: ReportQaGateInput): ReportQaGateResult {
  const reportText = String(input.reportText || "");
  const issues: ReportQaIssue[] = [];

  if (!reportText.trim()) {
    issues.push({
      id: "qa-empty-report",
      code: "empty_impression",
      severity: "block",
      title: "Informe vacío",
      detail: "No hay texto de informe para exportar.",
      fixHint: "Genere o redacté el reporte antes de crear el PDF.",
    });
  } else if (isEmptyImpression(reportText)) {
    issues.push({
      id: "qa-empty-impression",
      code: "empty_impression",
      severity: "block",
      title: "Impresión diagnóstica vacía",
      detail: "No se encontró una sección de impresión/conclusión con contenido usable.",
      fixHint: "Añada Impresión diagnóstica o Conclusión antes de firmar.",
    });
  }

  const lat = detectLateralityMismatch(reportText, input.laterality, input.studyType);
  if (lat?.mismatch) {
    issues.push({
      id: "qa-laterality",
      code: "laterality_mismatch",
      severity: "block",
      title: "Lateralidad inconsistente",
      detail: lat.detail,
      fixHint: "Alinee la lateralidad del estudio con el texto del informe.",
    });
  }

  const catIssue = categoryWithoutRecommendation(input.scorecard);
  if (catIssue) issues.push(catIssue);

  issues.push(...scorecardTextMismatches(reportText, input.scorecard));

  const enrichIssue = pendingEnrichmentIssues(input.enrichmentSession);
  if (enrichIssue) issues.push(enrichIssue);

  const blocks = issues.filter((i) => i.severity === "block");
  const warnings = issues.filter((i) => i.severity === "warn");
  return {
    issues,
    blocks,
    warnings,
    hasBlocks: blocks.length > 0,
    hasWarnings: warnings.length > 0,
    ok: issues.length === 0,
  };
}

export function reportQaIssueCodeLabel(code: ReportQaIssueCode): string {
  switch (code) {
    case "empty_impression":
      return "Impresión";
    case "laterality_mismatch":
      return "Lateralidad";
    case "category_without_recommendation":
      return "Categoría";
    case "scorecard_text_mismatch":
      return "Scorecard";
    case "pending_enrichment":
      return "Pulido";
    default:
      return "QA";
  }
}
