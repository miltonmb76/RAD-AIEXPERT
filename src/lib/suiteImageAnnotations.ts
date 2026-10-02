import { AbdomenFindingRow, SuiteImageAnnotation } from "../types";

export function newAnnotationId(): string {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(92, Math.max(8, n));
}

const COLORS: SuiteImageAnnotation["color"][] = ["amber", "cyan", "rose", "emerald"];
const ANCHORS = [
  { x: 28, y: 30 },
  { x: 68, y: 42 },
  { x: 40, y: 68 },
  { x: 72, y: 72 },
];

function firstNonEmpty(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(row?.[k] ?? "").trim();
    if (v) return v;
  }
  return "";
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
    const anchor = ANCHORS[idx % ANCHORS.length];
    return {
      id: newAnnotationId(),
      panelLetter: letter,
      text: String(row.text).trim().slice(0, 72),
      sizeLabel: row.sizeLabel ? String(row.sizeLabel).trim().slice(0, 32) : undefined,
      xPct: clampPct(anchor.x),
      yPct: clampPct(anchor.y),
      color: COLORS[idx % COLORS.length],
    };
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
export function withSuggestedImageAnnotations<T extends { panels?: Array<{ panelLetter: string }>; imageAnnotations?: SuiteImageAnnotation[] }>(
  data: T,
  suggestions: SuiteImageAnnotation[]
): T {
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
