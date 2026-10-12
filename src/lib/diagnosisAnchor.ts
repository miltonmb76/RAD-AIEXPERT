import type { ClinicalScorecardData, FindingsInfographicData } from "../types";

/**
 * Broad protocol/domain labels that must NOT become the session ancla.
 * Example bug: MSK ankle sprain → categoryAssigned "Musculoesquelético".
 */
const GENERIC_CATEGORY_RE =
  /^(musculoesquel[eé]tico|msk|abdominal|abdomen|vascular|gen[eé]rico|general|soft\s*tissue|tejidos?\s*blandos?|sin\s*categor[ií]a|n\/?a|no\s*aplicable|estudio|protocolo|regi[oó]n|regi[oó]n\s+de\s+inter[eé]s)$/i;

/** True when categoryAssigned looks like a domain/protocol tag, not a diagnosis. */
export function isGenericScorecardCategory(category: string): boolean {
  const t = String(category || "").trim();
  if (!t) return true;
  if (GENERIC_CATEGORY_RE.test(t)) return true;
  // Single short word without digits / formal systems → usually a domain tag
  const words = t.split(/\s+/).filter(Boolean);
  if (
    words.length === 1 &&
    t.length <= 22 &&
    !/\d/.test(t) &&
    !/(birads|ti-?rads|bosniak|li-?rads|grado|stage|bamberg|munich)/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Canonical clinical diagnosis from the scorecard — source of the session ancla.
 * Priority: finalDiagnosis → primary atlasFinding → non-generic category → clinicalSummary.
 */
export function resolveScorecardFinalDiagnosis(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard) return "";

  const explicit = String(scorecard.finalDiagnosis || "").trim();
  if (explicit) return explicit;

  const findings = Array.isArray(scorecard.atlasFindings)
    ? scorecard.atlasFindings
    : [];
  const primary = findings.find((f) => f.role === "primary");
  if (primary?.label?.trim()) return primary.label.trim();

  const bySeverity = [...findings].sort(
    (a, b) => (Number(b.severity) || 0) - (Number(a.severity) || 0)
  );
  if (bySeverity[0]?.label?.trim()) return bySeverity[0].label.trim();

  const cat = String(scorecard.categoryAssigned || "").trim();
  if (cat && !isGenericScorecardCategory(cat)) return cat;

  const summary = String(scorecard.clinicalSummary || "").trim();
  if (summary) {
    const first = (summary.split(/(?<=[.!?])\s+/)[0] || summary).trim();
    const cleaned = first.replace(/[.!?]+$/, "").trim();
    if (cleaned.length > 0 && cleaned.length <= 160) return cleaned;
    if (cleaned.length > 160) return `${cleaned.slice(0, 157).trim()}…`;
  }

  // Never seed domain tags like «Musculoesquelético» as the session ancla
  return "";
}

/**
 * Resolve the session diagnosis ancla.
 * Manual text always wins; otherwise scorecard finalDiagnosis (with fallbacks);
 * then infographic diagnosis.
 */
export function resolveDiagnosisAnchor(opts: {
  manualAnchor?: string | null;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
}): string {
  const manual = String(opts.manualAnchor || "").trim();
  if (manual) return manual;
  const fromScorecard = resolveScorecardFinalDiagnosis(opts.scorecardData);
  if (fromScorecard) return fromScorecard;
  const fromFig = String(opts.findingsInfographic?.diagnosis || "").trim();
  if (fromFig) return fromFig;
  return "";
}

/** Directive block appended to Atlas / suite generation prompts. */
export function buildAnchorDirective(anchor: string): string {
  const dx = String(anchor || "").trim();
  if (!dx) return "";
  return [
    `ANCLA DIAGNÓSTICA DE LA SESIÓN (obligatoria): «${dx}».`,
    "Centra la reconstrucción y los focos anatómicos en lo que sostiene este diagnóstico.",
    "No sustituyas el ancla por otra categoría o impresión distinta.",
  ].join("\n");
}

/** Seed ancla from scorecard only when the clinician has not set one yet. */
export function seedAnchorFromScorecard(
  current: string,
  scorecardData: ClinicalScorecardData | null | undefined
): string {
  if (String(current || "").trim()) return current;
  return resolveScorecardFinalDiagnosis(scorecardData);
}

/** Merge ancla into Atlas external directives without duplicating. */
export function mergeAnchorIntoDirectives(
  existing: string | undefined,
  anchor: string
): string {
  const base = String(existing || "").trim();
  const block = buildAnchorDirective(anchor);
  if (!block) return base;
  if (
    base.toLowerCase().includes(anchor.trim().toLowerCase()) &&
    base.includes("ANCLA DIAGNÓSTICA")
  ) {
    return base;
  }
  return [block, base].filter(Boolean).join("\n\n");
}
