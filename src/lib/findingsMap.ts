import type {
  Atlas3DData,
  AtlasPathologyOverlay,
  ClinicalScorecardData,
  FindingsInfographicData,
  FocalLesion3DData,
  SuiteImageAnnotation,
} from "../types";
import type { PackImageSource } from "./diagnosticPack";
import { buildAnnotation, clampPct } from "./suiteImageAnnotations";

export interface FindingsMapItem {
  id: string;
  marker: string;
  label: string;
  detail?: string;
  panelLetter: string;
  structure?: string;
  source: "overlay" | "infographic" | "synoptic" | "scorecard";
}

export type FindingsMapPanel = {
  panelLetter: string;
  panelTitle?: string;
  anatomicalFocus?: string;
  imageUrl?: string;
};

/** Visual canvas for the findings map (focal / suite / atlas). */
export type FindingsMapCanvas = {
  sourceId: string;
  label: string;
  panels: FindingsMapPanel[];
  imageAnnotations: SuiteImageAnnotation[];
};

export type FindingsMapSuiteSource = PackImageSource & {
  imageAnnotations?: SuiteImageAnnotation[] | null;
};

const TIP_FAN = [
  { x: 34, y: 36 },
  { x: 64, y: 42 },
  { x: 48, y: 62 },
  { x: 72, y: 68 },
  { x: 28, y: 58 },
  { x: 58, y: 28 },
];

function panelsWithImages(panels: any[] | null | undefined): FindingsMapPanel[] {
  return (panels || [])
    .filter((p) => p?.imageUrl)
    .map((p, i) => ({
      panelLetter: String(p.panelLetter || String.fromCharCode(65 + i)).toUpperCase(),
      panelTitle: p.panelTitle,
      anatomicalFocus: p.anatomicalFocus,
      imageUrl: p.imageUrl,
    }));
}

/** List all canvases that currently have at least one panel image. */
export function listFindingsMapCanvases(opts: {
  focalLesion3dData?: FocalLesion3DData | null;
  atlas3dData?: Atlas3DData | null;
  suiteSources?: FindingsMapSuiteSource[];
}): FindingsMapCanvas[] {
  const out: FindingsMapCanvas[] = [];

  const focalPanels = panelsWithImages(opts.focalLesion3dData?.panels);
  if (focalPanels.length) {
    out.push({
      sourceId: "focal",
      label: "Corte Focal 3D",
      panels: focalPanels,
      imageAnnotations: opts.focalLesion3dData?.imageAnnotations || [],
    });
  }

  for (const suite of opts.suiteSources || []) {
    const panels = panelsWithImages(suite.panels as any[]);
    if (!panels.length) continue;
    out.push({
      sourceId: suite.id,
      label: suite.label || suite.id,
      panels,
      imageAnnotations: suite.imageAnnotations || [],
    });
  }

  const atlasPanels = panelsWithImages(opts.atlas3dData?.panels);
  if (atlasPanels.length) {
    out.push({
      sourceId: "atlas3d",
      label: "Atlas 3D",
      panels: atlasPanels,
      imageAnnotations: opts.atlas3dData?.imageAnnotations || [],
    });
  }

  return out;
}

/**
 * Pick default canvas — same priority as diagnostic pack:
 * focal → preferred suite → atlas → any other suite.
 */
export function resolveFindingsMapCanvas(opts: {
  focalLesion3dData?: FocalLesion3DData | null;
  atlas3dData?: Atlas3DData | null;
  suiteSources?: FindingsMapSuiteSource[];
  preferredSuiteId?: string | null;
  /** Force a source when the clinician picks from the dropdown. */
  forcedSourceId?: string | null;
}): FindingsMapCanvas | null {
  const all = listFindingsMapCanvases(opts);
  if (!all.length) return null;

  const forced = String(opts.forcedSourceId || "").trim();
  if (forced) {
    const hit = all.find((c) => c.sourceId === forced);
    if (hit) return hit;
  }

  const preferredId = String(opts.preferredSuiteId || "").trim();
  const order = ["focal", preferredId, "atlas3d"].filter(Boolean);
  for (const id of order) {
    const hit = all.find((c) => c.sourceId === id);
    if (hit) return hit;
  }
  return all[0] || null;
}

/** Collect findings for the map from overlays, synoptic, infographic, scorecard. */
export function collectFindingsForMap(opts: {
  atlasData?: Atlas3DData | null;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
  /** Panel letters available on the active canvas (remap targets). */
  panelLetters?: string[];
}): FindingsMapItem[] {
  const items: FindingsMapItem[] = [];
  const seen = new Set<string>();
  const panelLetters =
    (opts.panelLetters || []).map((p) => p.toUpperCase()).filter(Boolean) ||
    (opts.atlasData?.panels || [])
      .map((p) => (p.panelLetter || "").toUpperCase())
      .filter(Boolean);
  const letters =
    panelLetters.length > 0
      ? panelLetters
      : (opts.atlasData?.panels || [])
          .map((p) => (p.panelLetter || "").toUpperCase())
          .filter(Boolean);
  const fallbackPanel = letters[0] || "A";

  const push = (item: FindingsMapItem) => {
    const key = `${item.label.toLowerCase()}|${item.panelLetter}`;
    if (seen.has(key) || !item.label.trim()) return;
    seen.add(key);
    items.push(item);
  };

  const overlays: AtlasPathologyOverlay[] =
    opts.atlasData?.pathologyOverlays ||
    opts.scorecardData?.atlasOverlays ||
    [];

  overlays.forEach((o, i) => {
    const letter = (o.panelLetter || fallbackPanel).toUpperCase();
    const panelLetter = letters.includes(letter) ? letter : fallbackPanel;
    push({
      id: o.id || `map-ov-${i + 1}`,
      marker: o.marker || String.fromCharCode(65 + i),
      label: String(o.finding || o.structure || "").trim(),
      detail: o.evidence || undefined,
      panelLetter,
      structure: o.structure,
      source: "overlay",
    });
  });

  const synoptic = opts.atlasData?.synopticExplanation || opts.atlasData?.synopticTable || [];
  synoptic.forEach((s, i) => {
    const ref = String(s.panelRef || "").match(/Panel\s*([A-Z])/i);
    const letter = (ref?.[1] || fallbackPanel).toUpperCase();
    push({
      id: `map-syn-${i + 1}`,
      marker: String(i + 1),
      label: String(s.structure || "").trim(),
      detail: String(s.findingDetail || "").trim() || undefined,
      panelLetter: letters.includes(letter) ? letter : fallbackPanel,
      structure: s.structure,
      source: "synoptic",
    });
  });

  const nodes = opts.findingsInfographic?.nodes || [];
  nodes.forEach((n, i) => {
    const group = String(n.group || "").trim();
    const panelLetter = letters[i % Math.max(letters.length, 1)] || fallbackPanel;
    push({
      id: n.id || `map-fig-${i + 1}`,
      marker: String.fromCharCode(65 + i),
      label: String(n.label || "").trim(),
      detail: n.detail || undefined,
      panelLetter,
      structure: group || undefined,
      source: "infographic",
    });
  });

  return items.slice(0, 10);
}

/**
 * Place map findings as SuiteImageAnnotation pins on the active canvas.
 * Replaces previous map-generated annotations (ids starting with map-pin-).
 */
export function placeFindingsAsAnnotations(
  canvas: FindingsMapCanvas,
  findings: FindingsMapItem[]
): SuiteImageAnnotation[] {
  const keep = (canvas.imageAnnotations || []).filter(
    (a) => !String(a.id || "").startsWith("map-pin-")
  );
  const letters = new Set(canvas.panels.map((p) => p.panelLetter.toUpperCase()));
  const fallback = canvas.panels[0]?.panelLetter || "A";
  const perPanelCount: Record<string, number> = {};
  const placed: SuiteImageAnnotation[] = findings.map((f, i) => {
    const raw = (f.panelLetter || fallback).toUpperCase();
    const letter = letters.has(raw) ? raw : fallback;
    const idx = perPanelCount[letter] || 0;
    perPanelCount[letter] = idx + 1;
    const tip = TIP_FAN[idx % TIP_FAN.length];
    const ann = buildAnnotation({
      panelLetter: letter,
      text: `${f.marker}. ${f.label}`.slice(0, 48),
      sizeLabel: f.detail ? f.detail.slice(0, 28) : "",
      tipX: clampPct(tip.x + (i % 3) * 2),
      tipY: clampPct(tip.y + (i % 2) * 3),
      color: (["amber", "cyan", "rose", "emerald"] as const)[i % 4],
      offsetIndex: idx,
    });
    return { ...ann, id: `map-pin-${f.id}` };
  });

  return [...keep, ...placed];
}

export function findingsMapSummary(items: FindingsMapItem[]): string {
  if (!items.length) return "Sin hallazgos para mapear.";
  const byPanel = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.panelLetter] = (acc[it.panelLetter] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(byPanel).map(([p, n]) => `Panel ${p}: ${n}`);
  return `${items.length} hallazgos · ${parts.join(" · ")}`;
}
