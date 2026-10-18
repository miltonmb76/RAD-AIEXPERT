/**
 * Shared annex chrome helpers for organ-suite PDFs and Pack-style narrative annexes.
 * Keeps accent color, soft fills, panel badges, Pack header band, and caption spacing consistent.
 */

export type PdfRgb = [number, number, number];

/** Vertical gap between panel image bottom and caption title (× factor). Matches Focal. */
export const ANNEX_CAPTION_GAP = 3.4;

/** Pack / Eco-3D / Explainer visual tokens (dark band + amber accent). */
export const PACK_ANNEX_COLORS = {
  bandFill: [41, 37, 36] as PdfRgb,
  amberBar: [217, 119, 6] as PdfRgb,
  titleText: [255, 251, 235] as PdfRgb,
  metaText: [253, 230, 138] as PdfRgb,
  sectionLabel: [180, 83, 9] as PdfRgb,
  bodyText: [28, 25, 23] as PdfRgb,
};

/** Fit a single-line label into maxWidth (ellipsis). Font must already be set on doc. */
export function fitPdfTextToWidth(
  doc: any,
  text: string,
  maxWidth: number
): string {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw || maxWidth <= 0) return "";
  if (doc.getTextWidth(raw) <= maxWidth) return raw;
  const ell = "…";
  let lo = 0;
  let hi = raw.length;
  let best = ell;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${raw.slice(0, mid).trimEnd()}${ell}`;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/**
 * Pack-style annex header: dark rounded band + amber rule.
 * Title left, meta right — text clipped inside the band (no overflow).
 * Returns the Y coordinate just below the amber bar + trailing gap.
 */
export function drawPackAnnexHeaderBand(
  doc: any,
  opts: {
    x: number;
    y: number;
    width: number;
    factor?: number;
    title: string;
    metaLines?: string[];
    /** Trailing gap under the amber bar (default Pack = 7). */
    afterGap?: number;
  }
): number {
  const factor = opts.factor ?? 1;
  const { x, width } = opts;
  let y = opts.y;
  const afterGap = opts.afterGap ?? 7 * factor;

  const titleRaw = String(opts.title || "ANEXO")
    .replace(/\s+/g, " ")
    .trim();
  const title =
    titleRaw.toUpperCase().startsWith("ANEXO")
      ? titleRaw
      : `ANEXO: ${titleRaw}`;

  const headerPadY = 3.2 * factor;
  const headerPadX = 4 * factor;
  const titleLineH = 4.2 * factor;
  const metaLineH = 3.4 * factor;
  const titleSize = 9 * factor;
  const metaSize = 7 * factor;
  const amberH = 1.1 * factor;

  // Reserve ~58% for title, rest for meta (with gutter).
  const titleMaxW = width * 0.58 - headerPadX;
  const metaMaxW = Math.max(24 * factor, width - titleMaxW - 14 * factor - headerPadX);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  const titleFit = fitPdfTextToWidth(doc, title, titleMaxW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(metaSize);
  const metaIn = (opts.metaLines || [])
    .map((s) => String(s || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const metaJoined = metaIn.join("  ·  ");
  let metaLines: string[] = [];
  if (metaJoined) {
    metaLines = (doc.splitTextToSize(metaJoined, metaMaxW) as string[]).slice(0, 2);
    metaLines = metaLines.map((line) => fitPdfTextToWidth(doc, line, metaMaxW));
  }

  const headerInnerH = Math.max(
    titleLineH,
    metaLines.length ? metaLines.length * metaLineH : 0
  );
  const headerH = headerPadY * 2 + headerInnerH;

  const { bandFill, amberBar, titleText, metaText } = PACK_ANNEX_COLORS;
  doc.setFillColor(bandFill[0], bandFill[1], bandFill[2]);
  doc.roundedRect(x, y, width, headerH, 1.5, 1.5, "F");
  doc.setFillColor(amberBar[0], amberBar[1], amberBar[2]);
  doc.rect(x, y + headerH, width, amberH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleSize);
  doc.setTextColor(titleText[0], titleText[1], titleText[2]);
  doc.text(titleFit, x + headerPadX, y + headerPadY + titleLineH * 0.78);

  if (metaLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(metaSize);
    doc.setTextColor(metaText[0], metaText[1], metaText[2]);
    metaLines.forEach((line, i) => {
      doc.text(line, x + width - headerPadX, y + headerPadY + metaLineH * (i + 0.78), {
        align: "right",
      });
    });
  }

  return y + headerH + amberH + afterGap;
}

/** Amber Pack section label (e.g. DIAGNÓSTICO ANCLA / HALLAZGO 1). */
export function drawPackAnnexSectionLabel(
  doc: any,
  opts: {
    text: string;
    x: number;
    y: number;
    factor?: number;
    maxWidth?: number;
    fontSize?: number;
  }
): number {
  const factor = opts.factor ?? 1;
  const fontSize = opts.fontSize ?? 7.5 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(
    PACK_ANNEX_COLORS.sectionLabel[0],
    PACK_ANNEX_COLORS.sectionLabel[1],
    PACK_ANNEX_COLORS.sectionLabel[2]
  );
  const label =
    typeof opts.maxWidth === "number" && opts.maxWidth > 0
      ? fitPdfTextToWidth(doc, opts.text, opts.maxWidth)
      : String(opts.text || "");
  doc.text(label, opts.x, opts.y);
  return opts.y + 5.5 * factor;
}

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
  const { x, y, factor, accent, maxWidth } = opts;
  const fontSize = opts.fontSize ?? 6.8 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const padX = 1.6 * factor;
  const badgeH = 5 * factor;
  const rawLabel = String(opts.label || "").replace(/\s+/g, " ").trim();
  let badgeW = Math.max(14 * factor, doc.getTextWidth(rawLabel) + padX * 2);
  if (typeof maxWidth === "number" && maxWidth > 0) {
    badgeW = Math.min(badgeW, maxWidth);
  }
  const textMax = Math.max(4 * factor, badgeW - padX * 2);
  const label = fitPdfTextToWidth(doc, rawLabel, textMax);
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(x, y, badgeW, badgeH, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + padX, y + badgeH * 0.72);
  return { width: badgeW, height: badgeH };
}

export interface SuitePanelLayout {
  panelCount: number;
  gap: number;
  cardWidth: number;
  imgWidth: number;
  imgHeight: number;
  /** Extra X offset from marginX (centers a single panel). */
  startOffsetX: number;
}

/**
 * Shared 1–3 panel figure layout for organ-suite PDFs.
 * Single panel uses ~62% width (height-capped) so the clinical dossier
 * below still fits on the same page instead of overflowing.
 */
export function computeSuitePanelLayout(
  contentWidth: number,
  panelCount: number,
  factor: number = 1
): SuitePanelLayout {
  const count = Math.min(Math.max(Math.floor(panelCount) || 1, 1), 3);
  const gap = count === 3 ? 2.2 : 3.0;
  const totalGaps = (count - 1) * gap;

  if (count === 1) {
    let cardWidth = Math.min(contentWidth * 0.62, contentWidth);
    let imgWidth = Math.max(1, cardWidth - 2);
    let imgHeight = imgWidth * (3 / 4);
    const maxImgH = 62 * factor;
    if (imgHeight > maxImgH) {
      imgHeight = maxImgH;
      imgWidth = imgHeight * (4 / 3);
      cardWidth = imgWidth + 2;
    }
    return {
      panelCount: count,
      gap,
      cardWidth,
      imgWidth,
      imgHeight,
      startOffsetX: Math.max(0, (contentWidth - cardWidth) / 2),
    };
  }

  const cardWidth = (contentWidth - totalGaps) / count;
  const imgWidth = Math.max(1, cardWidth - 2);
  const imgHeight = imgWidth * (3 / 4);
  return {
    panelCount: count,
    gap,
    cardWidth,
    imgWidth,
    imgHeight,
    startOffsetX: 0,
  };
}
