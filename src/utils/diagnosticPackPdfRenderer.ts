import {
  diagnosticPackIsRenderable,
  type DiagnosticPackData,
  type DiagnosticPackImageSlot,
} from "../lib/diagnosticPack";
import { sanitizePdfText } from "./sanitizePdfText";

function imageRatio(doc: any, dataUrl: string, fallback = 4 / 3): number {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || 0;
    const ih = Number(props?.height) || 0;
    if (iw > 0 && ih > 0) return iw / ih;
  } catch {
    /* ignore */
  }
  return fallback;
}

function drawImage(
  doc: any,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  try {
    const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, x, y, w, h);
  } catch (e) {
    console.warn("diagnosticPack image draw failed:", e);
  }
}

function closingNote(pack: DiagnosticPackData, factors: { label: string }[]): string {
  const primary = factors
    .slice(0, 3)
    .map((f) => f.label)
    .filter(Boolean);
  const lead = primary.length
    ? `En conjunto, ${primary.join("; ").toLowerCase()}`
    : "Los hallazgos del informe";
  return sanitizePdfText(
    `${lead} permiten sostener el diagnóstico de «${pack.diagnosis}»` +
      (pack.categoryLabel ? ` (${pack.categoryLabel})` : "") +
      ". Esta lámina resume la justificación clínica del ancla para revisión del informe."
  );
}

/**
 * One-page clinician pack — text left (spaced factors), images right (snug to aspect), closing note.
 */
export async function renderDiagnosticPackAnnexToPDF(
  doc: any,
  pack: DiagnosticPackData | null,
  options?: {
    marginX?: number;
    pageWidth?: number;
    pageHeight?: number;
  }
): Promise<void> {
  if (!diagnosticPackIsRenderable(pack) || !pack) return;

  const pageWidth = options?.pageWidth ?? doc.internal.pageSize.getWidth();
  const pageHeight = options?.pageHeight ?? doc.internal.pageSize.getHeight();
  const marginX = options?.marginX ?? 16;
  const marginTop = 16;
  const contentWidth = pageWidth - marginX * 2;
  const bottom = pageHeight - 12;

  doc.addPage();
  let y = marginTop;

  // Header
  doc.setFillColor(41, 37, 36);
  doc.roundedRect(marginX, y, contentWidth, 11, 1.5, 1.5, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(marginX, y + 11, contentWidth, 1.1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 251, 235);
  doc.text("ANEXO: PACK DE JUSTIFICACIÓN DIAGNÓSTICA", marginX + 4, y + 7.2);

  const metaRight = [pack.categoryLabel, pack.studyRegion]
    .filter(Boolean)
    .map((s) => sanitizePdfText(String(s)))
    .join("  ·  ");
  if (metaRight) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(253, 230, 138);
    doc.text(metaRight, marginX + contentWidth - 4, y + 7.2, { align: "right" });
  }

  y += 11 + 1.1 + 8;

  // Ancla
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("DIAGNÓSTICO ANCLA", marginX, y);
  y += 6;

  const dx = sanitizePdfText(pack.diagnosis);
  const dxLines = doc.splitTextToSize(dx, contentWidth) as string[];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(28, 25, 23);
  dxLines.forEach((line) => {
    doc.text(line, marginX, y);
    y += 6.2;
  });
  y += 2;

  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + 36, y);
  y += 6;

  // Columns: text LEFT · images RIGHT
  const colGap = 10;
  const imgColW = contentWidth * 0.42;
  const textColW = contentWidth - imgColW - colGap;
  const textX = marginX;
  const imgX = marginX + textColW + colGap;
  const colsTop = y;
  const footerReserve = 20;
  const usableBottom = bottom - footerReserve;

  const slots = [pack.imageA, pack.imageB].filter(
    (s): s is DiagnosticPackImageSlot => Boolean(s?.url)
  );

  const captionH = 5.2;
  const imgGap = 5.5;
  const framePad = 1.2;
  const ratios = slots.map((s) => imageRatio(doc, s.url));

  // Natural size: full column width, height from aspect (snug frame — no letterbox)
  const maxInnerW = imgColW - framePad * 2;
  const naturalInnerHs = ratios.map((r) => maxInnerW / r);
  const chrome = (slots.length > 0 ? slots.length * (framePad * 2 + captionH) : 0) +
    imgGap * Math.max(0, slots.length - 1);
  const naturalTotal = naturalInnerHs.reduce((a, b) => a + b, 0) + chrome;
  const maxImgBlock = Math.max(40, usableBottom - colsTop);

  // Scale width (and thus height) if the stack would overflow — still snug
  let innerW = maxInnerW;
  if (naturalTotal > maxImgBlock && naturalTotal > 0) {
    const availForImgs = Math.max(20, maxImgBlock - chrome);
    const naturalImgs = naturalInnerHs.reduce((a, b) => a + b, 0) || 1;
    innerW = maxInnerW * (availForImgs / naturalImgs);
  }

  let imgY = colsTop;
  slots.forEach((slot, i) => {
    const drawW = innerW;
    const drawH = drawW / ratios[i];
    const boxW = drawW + framePad * 2;
    const boxH = drawH + framePad * 2;

    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.setLineWidth(0.3);
    doc.roundedRect(imgX, imgY, boxW, boxH, 1.2, 1.2, "FD");
    drawImage(doc, slot.url, imgX + framePad, imgY + framePad, drawW, drawH);

    imgY += boxH + 1.2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const cap = sanitizePdfText(
      [slot.caption, slot.sourceLabel].filter(Boolean).join(" · ")
    );
    const capLines = doc.splitTextToSize(cap, imgColW) as string[];
    doc.text(capLines[0] || "", imgX, imgY + 2);
    imgY += captionH + (i < slots.length - 1 ? imgGap - 1.2 : 0);
  });

  // Right: synthesis + mini-ficha + spaced factors
  let textY = colsTop;
  const factors = (pack.factors || []).slice(0, 6);

  if (pack.synthesis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const synLines = doc.splitTextToSize(sanitizePdfText(pack.synthesis), textColW) as string[];
    synLines.slice(0, 5).forEach((line) => {
      doc.text(line, textX, textY);
      textY += 4;
    });
    textY += 5;
  }

  if (pack.factSheet?.rows?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text("MINI-FICHA", textX, textY);
    textY += 2;
    const rows = pack.factSheet.rows.slice(0, 5);
    const sheetH = 6 + rows.length * 4.4 + 5;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.3);
    doc.roundedRect(textX, textY, textColW, sheetH, 1.5, 1.5, "FD");
    let sy = textY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(28, 25, 23);
    doc.text(sanitizePdfText(pack.factSheet.title).slice(0, 42), textX + 3.5, sy);
    sy += 5;
    rows.forEach((r) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 113, 108);
      doc.text(sanitizePdfText(r.label) + ":", textX + 3.5, sy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(41, 37, 36);
      const val = sanitizePdfText(r.value);
      const lines = doc.splitTextToSize(val, textColW - 30) as string[];
      doc.text(lines[0] || "", textX + 24, sy);
      sy += 4.4;
    });
    textY += sheetH + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text("FACTORES QUE DEFINEN EL DIAGNÓSTICO", textX, textY);
  textY += 6.5;

  type FactorBlock = { labelLines: string[]; detailLines: string[]; accent: number[] };
  const blocks: FactorBlock[] = factors.map((f, i) => {
    const label = sanitizePdfText(`${i + 1}.  ${f.label}`);
    const labelLines = doc.splitTextToSize(label, textColW - 5) as string[];
    const detailLines = f.detail
      ? (doc.splitTextToSize(sanitizePdfText(f.detail), textColW - 5) as string[]).slice(0, 2)
      : [];
    return {
      labelLines,
      detailLines,
      accent: f.weight === "primary" ? [217, 119, 6] : [148, 163, 184],
    };
  });

  const contentH = (b: FactorBlock) =>
    b.labelLines.length * 4.2 + b.detailLines.length * 3.6 + 1;
  const factorsContentH = blocks.reduce((a, b) => a + contentH(b), 0);
  // Leave room for closing note under factors when text column is taller than images
  const factorsBudget = Math.max(0, usableBottom - textY - 18);
  const nGaps = Math.max(0, blocks.length - 1);
  let gap =
    nGaps > 0 ? Math.max(5, (factorsBudget - factorsContentH) / nGaps) : 5;
  gap = Math.min(gap, 12);

  blocks.forEach((b) => {
    const blockTop = textY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    b.labelLines.forEach((line) => {
      doc.text(line, textX + 4, textY);
      textY += 4.2;
    });
    if (b.detailLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(100, 116, 139);
      b.detailLines.forEach((line) => {
        doc.text(line, textX + 4, textY);
        textY += 3.6;
      });
    }
    const blockH = textY - blockTop + 1;
    doc.setFillColor(b.accent[0], b.accent[1], b.accent[2]);
    doc.rect(textX, blockTop - 3, 1.3, Math.max(blockH, 5.5), "F");
    textY += gap;
  });

  // Closing note — sits under columns, uses leftover page without forcing
  const afterCols = Math.max(imgY, textY) + 3;
  let closeY = afterCols;
  if (closeY < usableBottom - 14) {
    // Soft pull toward bottom when there's air, but keep a natural gap
    closeY = Math.min(usableBottom - 12, afterCols + (usableBottom - afterCols) * 0.35);
  }
  if (closeY > bottom - 10) closeY = bottom - 14;

  const note = closingNote(pack, factors);
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.3);
  doc.line(marginX, closeY, pageWidth - marginX, closeY);
  closeY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const noteLines = doc.splitTextToSize(note, contentWidth) as string[];
  noteLines.slice(0, 3).forEach((line) => {
    if (closeY > bottom - 1) return;
    doc.text(line, marginX, closeY);
    closeY += 3.6;
  });
}
