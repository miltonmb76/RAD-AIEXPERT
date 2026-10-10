import type {
  Atlas3DData,
  AtlasPathologyOverlay,
  ClinicalScorecardData,
  FindingsInfographicData,
  SuiteImageAnnotation,
} from "../types";
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

const TIP_FAN = [
  { x: 34, y: 36 },
  { x: 64, y: 42 },
  { x: 48, y: 62 },
  { x: 72, y: 68 },
  { x: 28, y: 58 },
  { x: 58, y: 28 },
];

/** Collect findings for the map from overlays, synoptic, infographic, scorecard. */
export function collectFindingsForMap(opts: {
  atlasData?: Atlas3DData | null;
  scorecardData?: ClinicalScorecardData | null;
  findingsInfographic?: FindingsInfographicData | null;
}): FindingsMapItem[] {
  const items: FindingsMapItem[] = [];
  const seen = new Set<string>();
  const panelLetters = (opts.atlasData?.panels || [])
    .map((p) => (p.panelLetter || "").toUpperCase())
    .filter(Boolean);
  const fallbackPanel = panelLetters[0] || "A";

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
    const panelLetter = panelLetters.includes(letter) ? letter : fallbackPanel;
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
      panelLetter: panelLetters.includes(letter) ? letter : fallbackPanel,
      structure: s.structure,
      source: "synoptic",
    });
  });

  const nodes = opts.findingsInfographic?.nodes || [];
  nodes.forEach((n, i) => {
    const group = String(n.group || "").trim();
    // Round-robin across panels when no group match
    const panelLetter =
      panelLetters[i % Math.max(panelLetters.length, 1)] || fallbackPanel;
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
 * Place map findings as SuiteImageAnnotation pins on Atlas panels.
 * Replaces previous map-generated annotations (ids starting with map-pin-).
 */
export function placeFindingsAsAnnotations(
  atlas: Atlas3DData,
  findings: FindingsMapItem[]
): Atlas3DData {
  const keep = (atlas.imageAnnotations || []).filter(
    (a) => !String(a.id || "").startsWith("map-pin-")
  );
  const perPanelCount: Record<string, number> = {};
  const placed: SuiteImageAnnotation[] = findings.map((f, i) => {
    const letter = (f.panelLetter || "A").toUpperCase();
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

  return {
    ...atlas,
    imageAnnotations: [...keep, ...placed],
  };
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
