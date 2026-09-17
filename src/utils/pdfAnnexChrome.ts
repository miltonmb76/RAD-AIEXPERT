/**
 * Shared annex chrome helpers for organ-suite PDFs.
 * Keeps accent color, soft fills, panel badges, and caption spacing consistent.
 */

export type PdfRgb = [number, number, number];

/** Vertical gap between panel image bottom and caption title (× factor). Matches Focal. */
export const ANNEX_CAPTION_GAP = 3.4;

/** Blend accent toward white for soft banner / zebra / dossier fills. */
export function softFillFromAccent(accent: PdfRgb, amount = 0.92): PdfRgb {
  return [
    Math.round(accent[0] + (255 - accent[0]) * amount),
    Math.round(accent[1] + (255 - accent[1]) * amount),
    Math.round(accent[2] + (255 - accent[2]) * amount),
  ];
}

/** Lighter accent border for banners / table rules. */
export function softBorderFromAccent(accent: PdfRgb, amount = 0.55): PdfRgb {
  return [
    Math.round(accent[0] + (255 - accent[0]) * amount),
    Math.round(accent[1] + (255 - accent[1]) * amount),
    Math.round(accent[2] + (255 - accent[2]) * amount),
  ];
}

/**
 * Draw a teal/accent panel badge sized to its label (avoids clipped "PANEL B · MACRO").
 */
export function drawAnnexPanelBadge(
  doc: any,
  opts: {
    label: string;
    x: number;
    y: number;
    factor: number;
    accent: PdfRgb;
    maxWidth?: number;
    fontSize?: number;
  }
): { width: number; height: number } {
  const { label, x, y, factor, accent, maxWidth } = opts;
  const fontSize = opts.fontSize ?? 6.8 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const padX = 1.6 * factor;
  const badgeH = 5 * factor;
  let badgeW = Math.max(14 * factor, doc.getTextWidth(label) + padX * 2);
  if (typeof maxWidth === "number" && maxWidth > 0) {
    badgeW = Math.min(badgeW, maxWidth);
  }
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(x, y, badgeW, badgeH, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + padX, y + badgeH * 0.72);
  return { width: badgeW, height: badgeH };
}
