import type {
  ClinicalScorecardData,
  SuiteImageAnnotation,
  UsPlaneBridgeLabel,
  UsPlaneBridgeRealImage,
  UsPlaneSimulatorData,
} from "../types";
import { buildAnnotation, suggestSuiteImageAnnotations } from "./suiteImageAnnotations";

export type GalleryImage = {
  id: string;
  url: string;
  label?: string;
  caption?: string;
  preview?: string;
  isSelected?: boolean;
};

/** Build bridge labels from plane data + optional gallery caption (legacy chips). */
export function buildUsPlaneBridgeLabels(
  plane: Pick<
    UsPlaneSimulatorData,
    | "targetStructure"
    | "lesionTarget"
    | "structuresCrossed"
    | "keyPoints"
    | "planeLabelEs"
    | "detectedLaterality"
  > | null | undefined,
  realUs?: UsPlaneBridgeRealImage | null
): UsPlaneBridgeLabel[] {
  const out: UsPlaneBridgeLabel[] = [];
  const seen = new Set<string>();

  const push = (text: string, side: UsPlaneBridgeLabel["side"] = "both") => {
    const t = String(text || "").trim();
    if (!t) return;
    const key = t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (seen.has(key) || out.length >= 8) return;
    seen.add(key);
    out.push({ id: `bridge-lbl-${out.length + 1}`, text: t, side });
  };

  if (plane?.lesionTarget) push(plane.lesionTarget, "both");
  if (realUs?.caption) push(realUs.caption, "us");
  else if (realUs?.label) push(realUs.label, "us");

  if (plane?.targetStructure) push(plane.targetStructure, "both");
  if (plane?.planeLabelEs) push(`Plano ${plane.planeLabelEs}`, "both");
  if (plane?.detectedLaterality) push(plane.detectedLaterality, "both");

  (plane?.structuresCrossed || []).slice(0, 5).forEach((s) => push(s, "anatomy"));
  (plane?.keyPoints || []).slice(0, 3).forEach((s) => push(s, "both"));

  return out;
}

/** Suggest injured-structure target from US caption, report snippet, scorecard. */
export function suggestLesionTarget(opts: {
  galleryCaption?: string | null;
  galleryLabel?: string | null;
  reportText?: string | null;
  scorecardData?: ClinicalScorecardData | null;
  planeTarget?: string | null;
}): string {
  const candidates: string[] = [];
  const push = (s?: string | null) => {
    const t = String(s || "").trim();
    if (t && t.length >= 3 && t.length <= 120) candidates.push(t);
  };

  push(opts.galleryCaption);
  push(opts.galleryLabel);
  push(opts.planeTarget);

  const sc = opts.scorecardData;
  if (sc) {
    push(sc.categoryAssigned);
    (sc.atlasOverlays || []).slice(0, 4).forEach((o) => {
      push(o.finding || o.structure);
    });
    (sc.criteria || [])
      .filter((c) => {
        const st = String(c.status || "").toLowerCase();
        return st === "met" || st === "equivocal";
      })
      .slice(0, 3)
      .forEach((c) => push(c.criterion));
  }

  const report = String(opts.reportText || "");
  // Prefer short diagnostic-ish lines from report
  const reportHits = report
    .split(/[\n.;]+/)
    .map((l) => l.trim())
    .filter((l) =>
      /tend[oó]n|menisc|ligamento|rotul|patel|quiste|n[oó]dulo|lesi[oó]n|desgarro|engros|ruptura|colelit|c[aá]lculo|tromb/i.test(
        l
      )
    )
    .slice(0, 3);
  reportHits.forEach((h) => push(h.slice(0, 100)));

  return candidates[0] || "";
}

/** Clinical lines to densify the PDF footer. */
export function buildBridgeClinicalContext(opts: {
  scorecardData?: ClinicalScorecardData | null;
  plane?: UsPlaneSimulatorData | null;
  lesionTarget?: string | null;
}): string[] {
  const lines: string[] = [];
  const push = (s?: string | null) => {
    const t = String(s || "").trim();
    if (!t) return;
    if (lines.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (lines.length < 8) lines.push(t);
  };

  if (opts.lesionTarget) push(`Estructura lesionada (objetivo del corte): ${opts.lesionTarget}`);
  const sc = opts.scorecardData;
  if (sc?.categoryAssigned) push(`Categoría / scorecard: ${sc.categoryAssigned}`);
  if (sc?.clinicalSummary) push(sc.clinicalSummary.slice(0, 280));
  (sc?.atlasOverlays || []).slice(0, 3).forEach((o) => {
    const blob = [o.structure, o.finding, o.evidence].filter(Boolean).join(" — ");
    push(blob.slice(0, 160));
  });
  (opts.plane?.keyPoints || []).slice(0, 4).forEach((k) => push(k));
  (opts.plane?.structuresCrossed || []).slice(0, 4).forEach((s) =>
    push(`Estructura cruzada: ${s}`)
  );
  return lines;
}

/** Prefer a labeled/selected gallery image as default eco real. */
export function suggestRealUsFromGallery(
  gallery: GalleryImage[] | null | undefined
): UsPlaneBridgeRealImage | null {
  const list = (gallery || []).filter((g) => g?.url && g?.id);
  if (!list.length) return null;
  const scored = [...list].sort((a, b) => {
    const score = (g: GalleryImage) =>
      (g.isSelected ? 4 : 0) +
      (String(g.caption || "").trim() ? 3 : 0) +
      (String(g.label || "").trim() ? 1 : 0);
    return score(b) - score(a);
  });
  const hit = scored[0];
  return {
    id: hit.id,
    url: hit.url,
    caption: String(hit.caption || "").trim() || undefined,
    label: String(hit.label || "").trim() || undefined,
  };
}

export function galleryToRealUs(img: GalleryImage): UsPlaneBridgeRealImage {
  return {
    id: img.id,
    url: img.url,
    caption: String(img.caption || "").trim() || undefined,
    label: String(img.label || "").trim() || undefined,
  };
}

/** Focal 3D cut for the bridge pair (prefer in_plane_cut — same axis as US). */
export function pickBridgeFocalPanel(data: UsPlaneSimulatorData | null | undefined) {
  const panels = data?.panels || [];
  return (
    panels.find((p) => p.panelRole === "in_plane_cut" && p.imageUrl) ||
    panels.find((p) => p.imageUrl) ||
    null
  );
}

/** @deprecated use pickBridgeFocalPanel */
export function pickBridgeAnatomyPanel(data: UsPlaneSimulatorData | null | undefined) {
  return pickBridgeFocalPanel(data);
}

/** Keep only the focal cut panel for bridge mode. */
export function keepFocalPanelsOnly(data: UsPlaneSimulatorData): UsPlaneSimulatorData {
  const focal = (data.panels || []).filter((p) => p.panelRole === "in_plane_cut" && p.imageUrl);
  const fallback = (data.panels || []).filter((p) => p.imageUrl).slice(0, 1);
  const panels = (focal.length ? focal : fallback).map((p, i) => ({
    ...p,
    panelLetter: "A",
    panelRole: "in_plane_cut" as const,
    panelTitle: p.panelTitle || "Corte 3D focal (estructura lesionada)",
  }));
  return {
    ...data,
    panels,
    figureTitle: data.figureTitle || "FIGURA. ECO REAL Y CORTE 3D FOCAL",
  };
}

/**
 * Seed suite-style arrow annotations for US + 3D from lesion target / structures.
 * panelLetter: "US" | "A"
 */
export function seedBridgeArrowAnnotations(opts: {
  lesionTarget?: string | null;
  realUs?: UsPlaneBridgeRealImage | null;
  structuresCrossed?: string[] | null;
  existing?: SuiteImageAnnotation[] | null;
}): SuiteImageAnnotation[] {
  if (opts.existing?.length) return opts.existing;

  const rows: Array<{ text: string }> = [];
  const lesion = String(opts.lesionTarget || "").trim();
  if (lesion) rows.push({ text: lesion });
  else if (opts.realUs?.caption) rows.push({ text: opts.realUs.caption });
  else if (opts.realUs?.label) rows.push({ text: opts.realUs.label });

  (opts.structuresCrossed || []).slice(0, 3).forEach((s) => {
    const t = String(s || "").trim();
    if (t && !rows.some((r) => r.text.toLowerCase() === t.toLowerCase())) {
      rows.push({ text: t });
    }
  });

  if (!rows.length) return [];

  // Primary lesion on both panels; extras mainly on 3D
  const usAnns = suggestSuiteImageAnnotations(rows.slice(0, 2), ["US"], 2).map((a, i) =>
    buildAnnotation({
      panelLetter: "US",
      text: a.text,
      tipX: a.xPct,
      tipY: a.yPct,
      labelX: a.labelXPct,
      labelY: a.labelYPct,
      color: i === 0 ? "emerald" : "cyan",
      offsetIndex: i,
    })
  );
  const a3d = suggestSuiteImageAnnotations(rows.slice(0, 4), ["A"], 4).map((a, i) =>
    buildAnnotation({
      panelLetter: "A",
      text: a.text,
      tipX: a.xPct,
      tipY: a.yPct,
      labelX: a.labelXPct,
      labelY: a.labelYPct,
      color: i === 0 ? "cyan" : i === 1 ? "amber" : "rose",
      offsetIndex: i,
    })
  );
  return [...usAnns, ...a3d];
}

/** Migrate legacy bridgeLabels (chips) → arrow annotations if needed. */
export function bridgeLabelsToAnnotations(
  labels: UsPlaneBridgeLabel[] | null | undefined
): SuiteImageAnnotation[] {
  const list = labels || [];
  if (!list.length) return [];
  const out: SuiteImageAnnotation[] = [];
  list.forEach((l, i) => {
    const side = l.side === "anatomy" ? "A" : l.side === "us" ? "US" : i % 2 === 0 ? "US" : "A";
    const tipX = typeof l.xPct === "number" ? l.xPct : 40 + (i % 3) * 12;
    const tipY = typeof l.yPct === "number" ? l.yPct : 35 + (i % 3) * 14;
    out.push(
      buildAnnotation({
        panelLetter: side,
        text: l.text,
        tipX,
        tipY,
        color: side === "US" ? "emerald" : "cyan",
        offsetIndex: i,
      })
    );
  });
  return out;
}
