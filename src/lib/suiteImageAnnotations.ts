import { AbdomenFindingRow, SuiteImageAnnotation } from "../types";

export function newAnnotationId(): string {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(92, Math.max(8, n));
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

/**
 * Suggest up to `max` annotations from the multi-organ finding table,
 * distributed across available panel letters.
 */
export function suggestAbdomenImageAnnotations(
  findingTable: AbdomenFindingRow[] | undefined,
  panelLetters: string[],
  max = 3
): SuiteImageAnnotation[] {
  const rows = (findingTable || []).filter(
    (r) =>
      String(r.structure || r.location || r.sizeOrThickness || r.stoneOrLesion || "").trim()
  );
  if (!rows.length || !panelLetters.length) return [];

  const colors: SuiteImageAnnotation["color"][] = ["amber", "cyan", "rose", "emerald"];
  // Spread anchors so callouts do not stack on first open
  const anchors = [
    { x: 28, y: 30 },
    { x: 68, y: 42 },
    { x: 40, y: 68 },
    { x: 72, y: 72 },
  ];

  return rows.slice(0, max).map((row, idx) => {
    const { text, sizeLabel } = labelFromAbdomenFindingRow(row);
    const letter = panelLetters[Math.min(idx, panelLetters.length - 1)];
    const anchor = anchors[idx % anchors.length];
    return {
      id: newAnnotationId(),
      panelLetter: letter,
      text,
      sizeLabel,
      xPct: clampPct(anchor.x),
      yPct: clampPct(anchor.y),
      color: colors[idx % colors.length],
    };
  });
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
