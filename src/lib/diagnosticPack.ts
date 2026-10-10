import type {
  Atlas3DData,
  ClinicalScorecardData,
  DominantLesionCardData,
  FindingsInfographicData,
  FocalLesion3DData,
} from "../types";
import { getScorecardGovernance } from "./clinicalIntelligence";
import { resolveDiagnosisAnchor } from "./diagnosisAnchor";

export interface DiagnosticPackFactor {
  id: string;
  label: string;
  detail?: string;
  weight?: "primary" | "secondary";
}

export interface DiagnosticPackData {
  title: string;
  /** Diagnóstico defendido (centro de la lámina). */
  diagnosis: string;
  studyRegion?: string;
  synthesis?: string;
  factors: DiagnosticPackFactor[];
  /** Optional 3D / US image for the pack. */
  imageDataUrl?: string | null;
  imageCaption?: string | null;
  categoryLabel?: string;
  generatedAt?: string;
}

/** Pick best available image: focal panel → atlas panel A → dominant-style atlas. */
export function pickPackImage(opts: {
  focalLesion3dData?: FocalLesion3DData | null;
  atlas3dData?: Atlas3DData | null;
}): { url: string | null; caption: string | null } {
  const focalPanels = opts.focalLesion3dData?.panels || [];
  const focal = focalPanels.find((p) => p?.imageUrl);
  if (focal?.imageUrl) {
    return {
      url: focal.imageUrl,
      caption: focal.panelTitle || focal.anatomicalFocus || "Corte 3D",
    };
  }
  const atlasPanels = opts.atlas3dData?.panels || [];
  const atlas = atlasPanels.find((p) => p?.imageUrl);
  if (atlas?.imageUrl) {
    return {
      url: atlas.imageUrl,
      caption: atlas.panelTitle || atlas.anatomicalFocus || "Atlas 3D",
    };
  }
  return { url: null, caption: null };
}

/**
 * Compose a one-page diagnostic pack from modules already generated.
 * No extra AI call — reuses justification nodes + 3D/focal image + ancla.
 */
export function buildDiagnosticPack(opts: {
  diagnosisAnchor?: string | null;
  findingsInfographic?: FindingsInfographicData | null;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  dominantLesionCard?: DominantLesionCardData | null;
}): DiagnosticPackData {
  const gov = getScorecardGovernance(opts.scorecardData);
  const diagnosis = resolveDiagnosisAnchor({
    manualAnchor: opts.diagnosisAnchor,
    scorecardData: opts.scorecardData,
    findingsInfographic: opts.findingsInfographic,
  }) ||
    String(opts.dominantLesionCard?.lesionLabel || "").trim() ||
    "Diagnóstico del informe";

  const fig = opts.findingsInfographic;
  const factors: DiagnosticPackFactor[] = (fig?.nodes || [])
    .filter((n) => String(n.label || "").trim())
    .slice(0, 7)
    .map((n, i) => ({
      id: n.id || `pack-f-${i + 1}`,
      label: n.label.trim(),
      detail: n.detail?.trim() || undefined,
      weight: n.weight || (i === 0 ? "primary" : "secondary"),
    }));

  // Fallback factors from scorecard active criteria / overlays
  if (!factors.length && opts.scorecardData) {
    const overlays = opts.scorecardData.atlasOverlays || [];
    for (let i = 0; i < Math.min(overlays.length, 6); i++) {
      const o = overlays[i];
      const label = String(o.finding || o.structure || "").trim();
      if (!label) continue;
      factors.push({
        id: o.id || `pack-ov-${i + 1}`,
        label,
        detail: o.evidence || undefined,
        weight: i < 2 ? "primary" : "secondary",
      });
    }
  }

  const img = pickPackImage({
    focalLesion3dData: opts.focalLesion3dData,
    atlas3dData: opts.atlas3dData,
  });

  const synthesis =
    String(fig?.synthesis || "").trim() ||
    String(opts.atlas3dData?.synthesis || opts.atlas3dData?.biomechanicalSynthesis || "").trim() ||
    String(gov?.clinicalSummary || "").trim() ||
    (factors.length
      ? `Los hallazgos listados sustentan el diagnóstico de ${diagnosis}.`
      : undefined);

  return {
    title: "Pack de justificación diagnóstica",
    diagnosis,
    studyRegion:
      fig?.studyRegion ||
      opts.atlas3dData?.studyRegion ||
      opts.focalLesion3dData?.studyRegion ||
      undefined,
    synthesis,
    factors,
    imageDataUrl: img.url,
    imageCaption: img.caption,
    categoryLabel: gov?.shortLabel || undefined,
    generatedAt: new Date().toISOString(),
  };
}

export function diagnosticPackIsRenderable(pack: DiagnosticPackData | null | undefined): boolean {
  if (!pack) return false;
  return Boolean(String(pack.diagnosis || "").trim() && (pack.factors?.length || pack.imageDataUrl));
}
