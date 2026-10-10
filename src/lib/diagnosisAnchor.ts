import type { ClinicalScorecardData, FindingsInfographicData } from "../types";
import { getScorecardGovernance } from "./clinicalIntelligence";

/**
 * Resolve the session diagnosis ancla.
 * Manual text always wins; otherwise scorecard category; then infographic diagnosis.
 */
export function resolveDiagnosisAnchor(opts: {
  manualAnchor?: string | null;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
}): string {
  const manual = String(opts.manualAnchor || "").trim();
  if (manual) return manual;
  const gov = getScorecardGovernance(opts.scorecardData);
  if (gov?.categoryAssigned) return gov.categoryAssigned;
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
  const gov = getScorecardGovernance(scorecardData);
  return gov?.categoryAssigned || "";
}

/** Merge ancla into Atlas external directives without duplicating. */
export function mergeAnchorIntoDirectives(
  existing: string | undefined,
  anchor: string
): string {
  const base = String(existing || "").trim();
  const block = buildAnchorDirective(anchor);
  if (!block) return base;
  if (base.toLowerCase().includes(anchor.trim().toLowerCase()) && base.includes("ANCLA DIAGNÓSTICA")) {
    return base;
  }
  return [block, base].filter(Boolean).join("\n\n");
}
