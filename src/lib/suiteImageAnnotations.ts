import { AbdomenFindingRow, SuiteImageAnnotation } from "../types";

export function newAnnotationId(): string {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(94, Math.max(6, n));
}

const COLORS: SuiteImageAnnotation["color"][] = ["amber", "cyan", "rose", "emerald"];

/** Tip anchors on the structure; labels sit offset so they do not cover anatomy. */
const TIP_ANCHORS = [
  { x: 32, y: 38 },
  { x: 62, y: 48 },
  { x: 44, y: 66 },
  { x: 70, y: 70 },
];

const LABEL_OFFSETS = [
  { dx: -18, dy: -16 },
  { dx: 18, dy: -14 },
  { dx: -16, dy: 14 },
  { dx: 16, dy: 12 },
];

function firstNonEmpty(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(row?.[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** Resolve tip + label positions (legacy annotations without label* still work). */
export function resolveAnnotationGeometry(ann: SuiteImageAnnotation): {
  tipX: number;
  tipY: number;
  labelX: number;
  labelY: number;
} {
  const tipX = clampPct(Number(ann.xPct) || 50);
  const tipY = clampPct(Number(ann.yPct) || 50);
  const hasLabel =
    Number.isFinite(Number(ann.labelXPct)) && Number.isFinite(Number(ann.labelYPct));
  if (hasLabel) {
    return {
      tipX,
      tipY,
      labelX: clampPct(Number(ann.labelXPct)),
      labelY: clampPct(Number(ann.labelYPct)),
    };
  }
  // Legacy: tip and pill were stacked — park the label up-left of the tip.
  return {
    tipX,
    tipY,
    labelX: clampPct(tipX - 14),
    labelY: clampPct(tipY - 12),
  };
}

export function buildAnnotation(args: {
  panelLetter: string;
  text: string;
  sizeLabel?: string;
  tipX: number;
  tipY: number;
  labelX?: number;
  labelY?: number;
  color?: SuiteImageAnnotation["color"];
  offsetIndex?: number;
}): SuiteImageAnnotation {
  const tipX = clampPct(args.tipX);
  const tipY = clampPct(args.tipY);
  const off = LABEL_OFFSETS[(args.offsetIndex || 0) % LABEL_OFFSETS.length];
  return {
    id: newAnnotationId(),
    panelLetter: args.panelLetter,
    text: String(args.text || "").trim().slice(0, 72),
    sizeLabel: args.sizeLabel ? String(args.sizeLabel).trim().slice(0, 32) : undefined,
    xPct: tipX,
    yPct: tipY,
    labelXPct: clampPct(args.labelX ?? tipX + off.dx),
    labelYPct: clampPct(args.labelY ?? tipY + off.dy),
    color: args.color || "amber",
  };
}

/** Generic suggestions from table-like rows. */
export function suggestSuiteImageAnnotations(
  rows: Array<{ text: string; sizeLabel?: string }> | undefined,
  panelLetters: string[],
  max = 3
): SuiteImageAnnotation[] {
  const clean = (rows || []).filter((r) => String(r.text || "").trim());
  if (!clean.length || !panelLetters.length) return [];

  return clean.slice(0, max).map((row, idx) => {
    const letter = panelLetters[Math.min(idx, panelLetters.length - 1)];
    const tip = TIP_ANCHORS[idx % TIP_ANCHORS.length];
    return buildAnnotation({
      panelLetter: letter,
      text: String(row.text).trim(),
      sizeLabel: row.sizeLabel,
      tipX: tip.x,
      tipY: tip.y,
      color: COLORS[idx % COLORS.length],
      offsetIndex: idx,
    });
  });
}

/** Map arbitrary table rows using preferred text/size field names. */
export function suggestFromTableRows(
  table: Array<Record<string, unknown>> | undefined,
  panelLetters: string[],
  textKeys: string[],
  sizeKeys: string[] = ["size", "sizeOrThickness", "sizeOrGap", "stenosisPercent"],
  max = 3
): SuiteImageAnnotation[] {
  const rows = (table || [])
    .map((row) => {
      const text = firstNonEmpty(row, textKeys);
      const sizeLabel = firstNonEmpty(row, sizeKeys) || undefined;
      return text ? { text, sizeLabel } : null;
    })
    .filter(Boolean) as Array<{ text: string; sizeLabel?: string }>;
  return suggestSuiteImageAnnotations(rows, panelLetters, max);
}

/** Build short callout text from an abdomen finding row. */
export function labelFromAbdomenFindingRow(row: AbdomenFindingRow): {
  text: string;
  sizeLabel?: string;
} {
  const structure = String(row.structure || "").trim();
  const location = String(row.location || "").trim();
  const text =
    [structure, location].filter(Boolean).join(" — ") ||
    String(row.stoneOrLesion || row.echoPattern || "Hallazgo").trim();
  const size = String(row.sizeOrThickness || "").trim();
  return {
    text: text.slice(0, 72),
    sizeLabel: size ? size.slice(0, 32) : undefined,
  };
}

export function suggestAbdomenImageAnnotations(
  findingTable: AbdomenFindingRow[] | undefined,
  panelLetters: string[],
  max = 3
): SuiteImageAnnotation[] {
  const rows = (findingTable || []).map(labelFromAbdomenFindingRow).filter((r) => r.text);
  return suggestSuiteImageAnnotations(rows, panelLetters, max);
}

/** Attach suggestions if the payload has no annotations yet. */
export function withSuggestedImageAnnotations<
  T extends { panels?: Array<{ panelLetter: string }>; imageAnnotations?: SuiteImageAnnotation[] }
>(data: T, suggestions: SuiteImageAnnotation[]): T {
  if (data.imageAnnotations?.length) return data;
  if (!suggestions.length) return data;
  return { ...data, imageAnnotations: suggestions };
}

export function remapAnnotationsPanelLetters(
  annotations: SuiteImageAnnotation[] | undefined,
  letterMap: Record<string, string>,
  removedLetter?: string
): SuiteImageAnnotation[] {
  return (annotations || [])
    .filter((a) => a.panelLetter !== removedLetter)
    .map((a) => ({
      ...a,
      panelLetter: letterMap[a.panelLetter] || a.panelLetter,
    }));
}

export function annotationsForPanel(
  annotations: SuiteImageAnnotation[] | undefined,
  panelLetter: string
): SuiteImageAnnotation[] {
  return (annotations || []).filter((a) => a.panelLetter === panelLetter);
}

/** Focal lesion: one callout per panel from lesion metadata. */
export function suggestFocalImageAnnotations(args: {
  panelLetters: string[];
  lesionLabel?: string;
  lesionSite?: string;
  lesionSize?: string;
}): SuiteImageAnnotation[] {
  const text =
    [args.lesionLabel, args.lesionSite].filter(Boolean).join(" — ") || "Lesión focal";
  const sizeLabel = String(args.lesionSize || "").trim() || undefined;
  return suggestSuiteImageAnnotations(
    (args.panelLetters || []).map(() => ({ text, sizeLabel })),
    args.panelLetters,
    Math.min(2, args.panelLetters.length || 1)
  );
}

/** Atlas: from synoptic / pathology overlay structures. */
export function suggestAtlasImageAnnotations(
  items: Array<Record<string, unknown>> | undefined,
  panelLetters: string[],
  max = 3
): SuiteImageAnnotation[] {
  return suggestFromTableRows(
    items,
    panelLetters,
    ["structure", "anatomicalStructure", "finding", "marker", "label"],
    ["size", "measurement", "evidence"],
    max
  );
}
