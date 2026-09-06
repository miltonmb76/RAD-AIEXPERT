import {
  Atlas3DData,
  AtlasPathologyOverlay,
  ClinicalScorecardData,
  ScorecardCriterion,
} from "../types";

/** Build Atlas customDirectives from scorecard so 3D generation focuses on active pathology. */
export function buildAtlasDirectivesFromScorecard(
  scorecard: ClinicalScorecardData | null | undefined
): string {
  if (!scorecard?.criteria?.length) return "";
  const active = scorecard.criteria.filter(
    (c) => c.status === "met" || c.status === "equivocal"
  );
  if (!active.length) return "";

  const lines = active.slice(0, 8).map((c, i) => {
    const val = c.value ? ` (${c.value})` : "";
    return `${i + 1}. Destacar «${c.atlasStructure || c.criterion}»${val}: ${c.evidence}`;
  });

  return [
    `PATOLOGÍA ACTIVA DEL SCORECARD (${scorecard.protocolName} — ${scorecard.categoryAssigned}):`,
    `Semáforo: ${scorecard.trafficLight}. Criterios positivos: ${scorecard.scoreMet}/${scorecard.scoreTotal}.`,
    "Prioriza visualmente estas estructuras/lesiones en los paneles 3D:",
    ...lines,
    "Usa highlight cromático / cutaway en la lesión dominante; no inventes hallazgos fuera de esta lista.",
  ].join("\n");
}

/** Merge scorecard-derived overlays onto existing atlas data (panel letters remapped if needed). */
export function mergeOverlaysOntoAtlas(
  atlas: Atlas3DData | null,
  overlays: AtlasPathologyOverlay[] | undefined,
  source: Atlas3DData["overlaySource"] = "scorecard"
): Atlas3DData | null {
  if (!atlas || !overlays?.length) return atlas;

  const panelLetters = (atlas.panels || [])
    .map((p) => (p.panelLetter || "").toUpperCase())
    .filter(Boolean);
  const fallbackLetter = panelLetters[0] || "A";

  const normalized = overlays.map((o, idx) => {
    const letter = (o.panelLetter || "").toUpperCase();
    const panelLetter = panelLetters.includes(letter) ? letter : fallbackLetter;
    return {
      ...o,
      id: o.id || `ov-${idx + 1}`,
      panelLetter,
      marker: o.marker || String.fromCharCode(65 + idx),
      severity: Math.min(10, Math.max(0, Math.round(o.severity || 0))),
      status: o.status || "active",
    } as AtlasPathologyOverlay;
  });

  // Enrich synoptic rows when structure matches and finding is richer
  const synoptic = [...(atlas.synopticExplanation || atlas.synopticTable || [])];
  for (const ov of normalized) {
    if (ov.severity < 2) continue;
    const idx = synoptic.findIndex(
      (s) =>
        (s.structure || "").toLowerCase().includes((ov.structure || "").toLowerCase().slice(0, 18)) ||
        (ov.structure || "").toLowerCase().includes((s.structure || "").toLowerCase().slice(0, 18))
    );
    const detail = `${ov.finding}${ov.evidence ? ` — ${ov.evidence}` : ""}`;
    if (idx >= 0) {
      synoptic[idx] = {
        ...synoptic[idx],
        findingDetail: detail,
        panelRef: synoptic[idx].panelRef || `(Panel ${ov.panelLetter})`,
      };
    } else {
      synoptic.push({
        structure: ov.structure,
        findingDetail: detail,
        panelRef: `(Panel ${ov.panelLetter})`,
      });
    }
  }

  return {
    ...atlas,
    pathologyOverlays: normalized,
    overlaySource: source,
    synopticExplanation: synoptic,
    synopticTable: synoptic,
  };
}

export function scorecardTrafficLabel(light: ClinicalScorecardData["trafficLight"]): string {
  switch (light) {
    case "critical":
      return "Crítico";
    case "high":
      return "Alto";
    case "moderate":
      return "Moderado";
    default:
      return "Bajo";
  }
}

export function criterionStatusLabel(status: ScorecardCriterion["status"]): string {
  switch (status) {
    case "met":
      return "Cumple";
    case "not_met":
      return "No cumple";
    case "equivocal":
      return "Dudoso";
    default:
      return "No mencionado";
  }
}

export function criterionWeightLabel(weight: ScorecardCriterion["weight"] | string): string {
  switch (weight) {
    case "critical":
      return "Crítico";
    case "major":
      return "Mayor";
    case "minor":
      return "Menor";
    default:
      return String(weight || "");
  }
}

export const SCORECARD_PROTOCOL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "auto", label: "Detección automática" },
  { id: "custom", label: "Personalizado (usar cuadro de texto)" },
  { id: "cholecystitis", label: "Colecistitis aguda" },
  { id: "appendicitis", label: "Apendicitis" },
  { id: "thyroid_tirads", label: "TI-RADS / Tiroides" },
  { id: "bosniak", label: "Bosniak / Quiste renal" },
  { id: "rotator_cuff", label: "Manguito rotador" },
  { id: "achilles", label: "Tendón de Aquiles" },
  { id: "hepatic", label: "Hígado / Esteatosis-Fibrosis" },
  { id: "renal", label: "Riñón integral" },
  { id: "scrotal", label: "Escrotal / Testicular" },
  { id: "diverticulitis", label: "Diverticulitis" },
  { id: "generic", label: "Criterios genéricos del informe" },
];
