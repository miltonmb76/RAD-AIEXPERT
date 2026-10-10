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
  protocolLabel?: string;
  synthesis?: string;
  factors: DiagnosticPackFactor[];
  /** Required for PDF annex — 3D / suite / focal. */
  imageDataUrl?: string | null;
  imageCaption?: string | null;
  imageSourceLabel?: string | null;
  categoryLabel?: string;
  /** Target was 6; may be 4 when sources are thin. */
  factorTarget: 4 | 6;
  generatedAt?: string;
}

/** Panel-like shape shared by Atlas, Focal and organ suites. */
export type PackImagePanel = {
  imageUrl?: string;
  panelTitle?: string;
  anatomicalFocus?: string;
} | null;

export type PackImageSource = {
  id: string;
  label: string;
  panels?: PackImagePanel[] | null;
  /** Suite finding table rows (abdomen, mama, etc.) for factor enrichment. */
  findingTable?: unknown[] | null;
};

function firstPanelImage(
  panels: PackImagePanel[] | null | undefined,
  fallbackCaption: string
): { url: string; caption: string; sourceLabel: string } | null {
  const hit = (panels || []).find((p) => p?.imageUrl);
  if (!hit?.imageUrl) return null;
  return {
    url: hit.imageUrl,
    caption: hit.panelTitle || hit.anatomicalFocus || fallbackCaption,
    sourceLabel: fallbackCaption,
  };
}

/**
 * Pick best available image:
 * 1) Corte Focal 3D
 * 2) Suite 3D correspondiente al estudio (preferredSuiteId)
 * 3) Atlas 3D
 * 4) Cualquier otra suite 3D con imagen
 */
export function pickPackImage(opts: {
  focalLesion3dData?: FocalLesion3DData | null;
  atlas3dData?: Atlas3DData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
}): { url: string | null; caption: string | null; sourceLabel: string | null } {
  const focal = firstPanelImage(opts.focalLesion3dData?.panels, "Corte Focal 3D");
  if (focal) return focal;

  const suites = opts.suiteSources || [];
  const preferredId = String(opts.preferredSuiteId || "").trim();
  if (preferredId) {
    const preferred = suites.find((s) => s.id === preferredId);
    const fromPreferred = firstPanelImage(
      preferred?.panels,
      preferred?.label || "Suite 3D"
    );
    if (fromPreferred) return fromPreferred;
  }

  const atlas = firstPanelImage(opts.atlas3dData?.panels, "Atlas 3D");
  if (atlas) return atlas;

  for (const suite of suites) {
    if (preferredId && suite.id === preferredId) continue;
    const hit = firstPanelImage(suite.panels, suite.label || "Suite 3D");
    if (hit) return hit;
  }

  return { url: null, caption: null, sourceLabel: null };
}

function normKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushFactor(
  factors: DiagnosticPackFactor[],
  seen: Set<string>,
  factor: DiagnosticPackFactor
) {
  const label = String(factor.label || "").trim();
  if (!label || factors.length >= 8) return;
  const key = normKey(label);
  if (!key || seen.has(key)) return;
  // Soft dedupe: skip if an existing label contains this or vice versa (len>=8)
  for (const s of seen) {
    if (key.length >= 8 && (s.includes(key) || key.includes(s))) return;
  }
  seen.add(key);
  factors.push({
    ...factor,
    label,
    detail: factor.detail?.trim() || undefined,
  });
}

function field(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(row?.[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** Extract factors from a suite findingTable row (generic field names). */
function factorsFromFindingRow(
  row: unknown,
  idx: number
): DiagnosticPackFactor | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const structure = field(r, [
    "structure",
    "location",
    "vessel",
    "vesselName",
    "site",
    "lesionLabel",
    "lobeOrNode",
  ]);
  const pattern = field(r, [
    "echoPattern",
    "finding",
    "findingDetail",
    "plaqueOrThrombus",
    "composition",
    "shape",
    "margins",
    "echogenicity",
    "tiradsCategory",
    "biradsCategory",
    "patternOrVelocity",
    "clinicalImpact",
  ]);
  const measure = field(r, [
    "sizeOrThickness",
    "thicknessOrGap",
    "size",
    "stenosisPercent",
    "hemodynamicIndex",
    "value",
  ]);
  const label = structure || pattern;
  if (!label) return null;
  const detailParts = [pattern && pattern !== label ? pattern : "", measure]
    .filter(Boolean)
    .join(" · ");
  return {
    id: `pack-suite-${idx + 1}`,
    label,
    detail: detailParts || undefined,
    weight: idx < 2 ? "primary" : "secondary",
  };
}

/**
 * Compose a dense one-page clinician pack.
 * Target 6 factors (min 4 if sources are thin). Image required for PDF.
 */
export function buildDiagnosticPack(opts: {
  diagnosisAnchor?: string | null;
  findingsInfographic?: FindingsInfographicData | null;
  scorecardData?: ClinicalScorecardData | null;
  atlas3dData?: Atlas3DData | null;
  focalLesion3dData?: FocalLesion3DData | null;
  dominantLesionCard?: DominantLesionCardData | null;
  suiteSources?: PackImageSource[];
  preferredSuiteId?: string | null;
}): DiagnosticPackData {
  const gov = getScorecardGovernance(opts.scorecardData);
  const diagnosis =
    resolveDiagnosisAnchor({
      manualAnchor: opts.diagnosisAnchor,
      scorecardData: opts.scorecardData,
      findingsInfographic: opts.findingsInfographic,
    }) ||
    String(opts.dominantLesionCard?.lesionLabel || "").trim() ||
    "Diagnóstico del informe";

  const fig = opts.findingsInfographic;
  const factors: DiagnosticPackFactor[] = [];
  const seen = new Set<string>();

  // 1) Justification infographic nodes
  (fig?.nodes || []).forEach((n, i) => {
    pushFactor(factors, seen, {
      id: n.id || `pack-f-${i + 1}`,
      label: String(n.label || "").trim(),
      detail: n.detail?.trim() || undefined,
      weight: n.weight || (i < 2 ? "primary" : "secondary"),
    });
  });

  // 2) Scorecard overlays
  (opts.scorecardData?.atlasOverlays || []).forEach((o, i) => {
    pushFactor(factors, seen, {
      id: o.id || `pack-ov-${i + 1}`,
      label: String(o.finding || o.structure || "").trim(),
      detail: o.evidence || undefined,
      weight: i < 2 ? "primary" : "secondary",
    });
  });

  // 3) Scorecard met / equivocal criteria
  (opts.scorecardData?.criteria || []).forEach((c, i) => {
    const status = String(c.status || "").toLowerCase();
    if (status !== "met" && status !== "equivocal") return;
    pushFactor(factors, seen, {
      id: c.id || `pack-crit-${i + 1}`,
      label: String(c.criterion || "").trim(),
      detail: String(c.evidence || c.value || "").trim() || undefined,
      weight: c.weight === "critical" || c.weight === "major" ? "primary" : "secondary",
    });
  });

  // 4) Atlas synoptic
  const synoptic =
    opts.atlas3dData?.synopticExplanation || opts.atlas3dData?.synopticTable || [];
  synoptic.forEach((s, i) => {
    pushFactor(factors, seen, {
      id: `pack-syn-${i + 1}`,
      label: String(s.structure || "").trim(),
      detail: String(s.findingDetail || "").trim() || undefined,
      weight: i < 2 ? "primary" : "secondary",
    });
  });

  // 5) Preferred suite finding table, then other suites
  const suites = opts.suiteSources || [];
  const preferredId = String(opts.preferredSuiteId || "").trim();
  const orderedSuites = [
    ...suites.filter((s) => s.id === preferredId),
    ...suites.filter((s) => s.id !== preferredId),
  ];
  for (const suite of orderedSuites) {
    (suite.findingTable || []).forEach((row, i) => {
      const f = factorsFromFindingRow(row, i);
      if (f) pushFactor(factors, seen, f);
    });
  }

  // 6) Dominant lesion descriptors
  (opts.dominantLesionCard?.keyDescriptors || []).forEach((d, i) => {
    pushFactor(factors, seen, {
      id: `pack-dom-${i + 1}`,
      label: String(d || "").trim(),
      weight: "secondary",
    });
  });
  if (opts.dominantLesionCard?.sizeSummary) {
    pushFactor(factors, seen, {
      id: "pack-dom-size",
      label: String(opts.dominantLesionCard.lesionLabel || "Lesión dominante").trim(),
      detail: opts.dominantLesionCard.sizeSummary,
      weight: "primary",
    });
  }

  // Prefer 6 factors; keep whatever we have (PDF requires ≥4).
  const finalFactors = factors.slice(0, 6);

  const img = pickPackImage({
    focalLesion3dData: opts.focalLesion3dData,
    atlas3dData: opts.atlas3dData,
    suiteSources: opts.suiteSources,
    preferredSuiteId: opts.preferredSuiteId,
  });

  const synthesis =
    String(fig?.synthesis || "").trim() ||
    String(opts.atlas3dData?.synthesis || opts.atlas3dData?.biomechanicalSynthesis || "").trim() ||
    String(gov?.clinicalSummary || "").trim() ||
    String(opts.dominantLesionCard?.clinicianPhrase || "").trim() ||
    (finalFactors.length
      ? `En conjunto, los factores documentados sustentan el diagnóstico de ${diagnosis}.`
      : undefined);

  const preferredSuite = suites.find((s) => s.id === preferredId);

  return {
    title: "Pack de justificación diagnóstica",
    diagnosis,
    studyRegion:
      fig?.studyRegion ||
      opts.atlas3dData?.studyRegion ||
      opts.focalLesion3dData?.studyRegion ||
      opts.dominantLesionCard?.studyRegion ||
      undefined,
    protocolLabel: gov?.protocolName || preferredSuite?.label || undefined,
    synthesis,
    factors: finalFactors,
    imageDataUrl: img.url,
    imageCaption: img.caption,
    imageSourceLabel: img.sourceLabel,
    categoryLabel: gov?.shortLabel || undefined,
    factorTarget: finalFactors.length >= 6 ? 6 : 4,
    generatedAt: new Date().toISOString(),
  };
}

/** Ready for PDF: ancla + imagen obligatoria + al menos 4 factores. */
export function diagnosticPackIsRenderable(pack: DiagnosticPackData | null | undefined): boolean {
  if (!pack) return false;
  const dx = String(pack.diagnosis || "").trim();
  const n = pack.factors?.length || 0;
  return Boolean(dx && pack.imageDataUrl && n >= 4);
}

export function diagnosticPackMissingRequirements(
  pack: DiagnosticPackData | null | undefined
): string[] {
  const missing: string[] = [];
  if (!pack || !String(pack.diagnosis || "").trim()) {
    missing.push("Define el ancla diagnóstica.");
  }
  if (!pack?.imageDataUrl) {
    missing.push("Genera Corte Focal, la suite 3D del estudio o el Atlas (imagen obligatoria).");
  }
  const n = pack?.factors?.length || 0;
  if (n < 4) {
    missing.push(
      `Hacen falta factores de soporte (mín. 4; ideal 6). Ahora: ${n}. Genera justificación y/o scorecard.`
    );
  }
  return missing;
}
