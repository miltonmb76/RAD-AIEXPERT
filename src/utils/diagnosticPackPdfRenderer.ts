import {
  diagnosticPackIsRenderable,
  type DiagnosticPackData,
} from "../lib/diagnosticPack";
import { sanitizePdfText } from "./sanitizePdfText";

function drawContainedImage(
  doc: any,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number
): void {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || boxW;
    const ih = Number(props?.height) || boxH;
    const ratio = iw > 0 && ih > 0 ? iw / ih : 1;
    let drawW = boxW;
    let drawH = drawW / ratio;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * ratio;
    }
    const ox = x + (boxW - drawW) / 2;
    const oy = y + (boxH - drawH) / 2;
    const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, ox, oy, drawW, drawH);
  } catch (e) {
    console.warn("diagnosticPack image draw failed:", e);
  }
}

/**
 * One-page clinician pack — safe margins, dual contain images, mini-ficha, ancla factors.
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
  // Keep clear of printer/clip margins (was invading top edge).
  const marginX = options?.marginX ?? 16;
  const marginTop = 18;
  const contentWidth = pageWidth - marginX * 2;
  const bottom = pageHeight - 14;

  doc.addPage();
  let y = marginTop;

  // Header inside safe area (not full-bleed to page edge)
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

  y += 11 + 1.1 + 9;

  // Ancla
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("DIAGNÓSTICO ANCLA", marginX, y);
  y += 6.5;

  const dx = sanitizePdfText(pack.diagnosis);
  const dxLines = doc.splitTextToSize(dx, contentWidth);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(28, 25, 23);
  dxLines.forEach((line: string) => {
    doc.text(line, marginX, y);
    y += 6.5;
  });
  y += 3;

  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + 36, y);
  y += 7;

  const colGap = 8;
  const leftW = contentWidth * 0.54;
  const rightW = contentWidth - leftW - colGap;
  const leftX = marginX;
  const rightX = marginX + leftW + colGap;
  const colsTop = y;
  let leftY = y;

  if (pack.synthesis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const synLines = doc.splitTextToSize(sanitizePdfText(pack.synthesis), leftW);
    synLines.slice(0, 4).forEach((line: string) => {
      doc.text(line, leftX, leftY);
      leftY += 4;
    });
    leftY += 4;
  }

  // Mini-ficha
  if (pack.factSheet?.rows?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text("MINI-FICHA", leftX, leftY);
    leftY += 2;
    const sheetH =
      6 +
      pack.factSheet.rows.length * 4.2 +
      6;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.3);
    doc.roundedRect(leftX, leftY, leftW, sheetH, 1.5, 1.5, "FD");
    let sy = leftY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(28, 25, 23);
    doc.text(sanitizePdfText(pack.factSheet.title).slice(0, 48), leftX + 3.5, sy);
    sy += 5;
    pack.factSheet.rows.forEach((r) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 113, 108);
      doc.text(sanitizePdfText(r.label) + ":", leftX + 3.5, sy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(41, 37, 36);
      const val = sanitizePdfText(r.value);
      const lines = doc.splitTextToSize(val, leftW - 28);
      doc.text(lines[0] || "", leftX + 22, sy);
      sy += 4.2;
    });
    leftY += sheetH + 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text("FACTORES QUE DEFINEN EL DIAGNÓSTICO", leftX, leftY);
  leftY += 5.5;

  const factors = (pack.factors || []).slice(0, 6);
  factors.forEach((f, i) => {
    const blockTop = leftY;
    const accent = f.weight === "primary" ? [217, 119, 6] : [148, 163, 184];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const label = sanitizePdfText(`${i + 1}.  ${f.label}`);
    const labelLines = doc.splitTextToSize(label, leftW - 5);
    labelLines.forEach((line: string) => {
      doc.text(line, leftX + 4, leftY);
      leftY += 4;
    });
    if (f.detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(100, 116, 139);
      const detailLines = doc.splitTextToSize(sanitizePdfText(f.detail), leftW - 5);
      detailLines.slice(0, 2).forEach((line: string) => {
        doc.text(line, leftX + 4, leftY);
        leftY += 3.5;
      });
    }
    const blockH = leftY - blockTop + 1;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(leftX, blockTop - 3, 1.3, Math.max(blockH, 5.5), "F");
    leftY += 2.8;
  });

  // Right column: up to 2 contained images
  const slots = [pack.imageA, pack.imageB].filter(
    (s): s is NonNullable<typeof pack.imageA> => Boolean(s?.url)
  );
  let rightY = colsTop;
  const availableH = bottom - colsTop - 12;
  const gap = 5;
  const n = Math.max(slots.length, 1);
  const eachH = (availableH - gap * (n - 1)) / n;

  slots.forEach((slot) => {
    const framePad = 2.5;
    const captionH = 7;
    const boxH = Math.max(28, eachH - captionH);
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.setLineWidth(0.35);
    doc.roundedRect(rightX, rightY, rightW, boxH, 2, 2, "FD");
    drawContainedImage(
      doc,
      slot!.url,
      rightX + framePad,
      rightY + framePad,
      rightW - framePad * 2,
      boxH - framePad * 2
    );
    rightY += boxH + 1.5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    const cap = sanitizePdfText(
      [slot!.caption, slot!.sourceLabel].filter(Boolean).join(" · ")
    );
    const capLines = doc.splitTextToSize(cap, rightW);
    doc.text(capLines[0] || "", rightX, rightY + 2.5);
    rightY += captionH + gap - 1.5;
  });

  const footerY = Math.min(Math.max(leftY, rightY) + 4, bottom - 2);
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerY, pageWidth - marginX, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 113, 108);
  const footer = sanitizePdfText(
    `Factores del informe que sustentan «${pack.diagnosis}» · ${factors.length} factor${
      factors.length === 1 ? "" : "es"
    }${pack.factorsFromJustification ? " · desde justificación" : ""}`
  );
  doc.text(footer, marginX, footerY + 4.2);
}
