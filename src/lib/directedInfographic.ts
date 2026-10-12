/** Classic directed poster — brief controls (not the justification diagram). */

export type DirectedRecommendationMode = "none" | "clinician" | "both";

export const DIRECTED_SECTION_OPTIONS = [
  "Características",
  "Tipo / clasificación",
  "Riesgo",
  "Conducta / recomendación",
  "Diferencial",
  "Medidas",
  "Lateralidad / localización",
] as const;

export type DirectedSectionOption = (typeof DIRECTED_SECTION_OPTIONS)[number];

export interface DirectedInfographicBrief {
  topic: string;
  orientation: string;
  sections: string[];
  recommendations: DirectedRecommendationMode;
  correctionNotes?: string;
}

export function defaultDirectedSections(): string[] {
  return ["Características", "Tipo / clasificación", "Conducta / recomendación"];
}

export function toggleDirectedSection(current: string[], section: string): string[] {
  const set = new Set(current);
  if (set.has(section)) set.delete(section);
  else set.add(section);
  // Preserve option order
  return DIRECTED_SECTION_OPTIONS.filter((s) => set.has(s));
}

export function directedBriefIsReady(brief: Pick<DirectedInfographicBrief, "topic" | "orientation">): boolean {
  return String(brief.topic || "").trim().length >= 3;
}

/** Compact scorecard blob for the directed prompt (optional evidence). */
export function buildDirectedScorecardContext(scorecard: {
  finalDiagnosis?: string;
  categoryAssigned?: string;
  protocolName?: string;
  clinicalSummary?: string;
  recommendation?: string;
} | null | undefined): string {
  if (!scorecard) return "";
  const lines = [
    scorecard.finalDiagnosis ? `Diagnóstico final: ${scorecard.finalDiagnosis}` : "",
    scorecard.categoryAssigned ? `Categoría protocolo: ${scorecard.categoryAssigned}` : "",
    scorecard.protocolName ? `Protocolo: ${scorecard.protocolName}` : "",
    scorecard.clinicalSummary ? `Resumen: ${scorecard.clinicalSummary}` : "",
    scorecard.recommendation ? `Conducta scorecard: ${scorecard.recommendation}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
