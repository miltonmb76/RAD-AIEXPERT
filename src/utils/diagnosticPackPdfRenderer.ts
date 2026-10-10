import {
  diagnosticPackIsRenderable,
  type DiagnosticPackData,
} from "../lib/diagnosticPack";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * One-page clinician pack — dense elegant layout:
 * header strip → ancla with air → 55/45 columns (factors | framed image) → footer.
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
  const marginX = options?.marginX ?? 14;
  const contentWidth = pageWidth - marginX * 2;
  const bottom = pageHeight - 14;

  doc.addPage();

  // --- Header strip (single band — no colliding grey rule) ---
  const headerH = 14;
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, pageWidth, headerH + 4, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(0, headerH + 4, pageWidth, 1.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 251, 235);
  doc.text("ANEXO: PACK DE JUSTIFICACIÓN DIAGNÓSTICA", marginX, 9);

  const metaRight = [pack.categoryLabel, pack.studyRegion, pack.protocolLabel]
    .filter(Boolean)
    .map((s) => sanitizePdfText(String(s)))
    .join("  ·  ");
  if (metaRight) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(253, 230, 138);
    doc.text(metaRight, pageWidth - marginX, 9, { align: "right" });
  }

  let y = headerH + 4 + 10;

  // --- Ancla (breathing room, no second hairline against title) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("DIAGNÓSTICO ANCLA", marginX, y);
  y += 6;

  const dx = sanitizePdfText(pack.diagnosis);
  const dxLines = doc.splitTextToSize(dx, contentWidth);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  dxLines.forEach((line: string) => {
    doc.text(line, marginX, y);
    y += 6.8;
  });
  y += 4;

  // Soft amber rule under ancla (spaced)
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + Math.min(42, contentWidth * 0.28), y);
  y += 7;

  // --- Columns ---
  const colGap = 8;
  const leftW = contentWidth * 0.55;
  const rightW = contentWidth - leftW - colGap;
  const leftX = marginX;
  const rightX = marginX + leftW + colGap;
  const colsTop = y;
  let leftY = y;

  // Synthesis
  if (pack.synthesis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const synLines = doc.splitTextToSize(sanitizePdfText(pack.synthesis), leftW);
    synLines.slice(0, 5).forEach((line: string) => {
      doc.text(line, leftX, leftY);
      leftY += 4.1;
    });
    leftY += 5;
  }

  // Category chip
  if (pack.categoryLabel) {
    const chip = sanitizePdfText(pack.categoryLabel);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const chipW = Math.min(leftW, doc.getTextWidth(chip) + 8);
    doc.setFillColor(255, 247, 237);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(leftX, leftY - 3.5, chipW, 7, 1.2, 1.2, "FD");
    doc.setTextColor(146, 64, 14);
    doc.text(chip, leftX + 4, leftY + 1);
    leftY += 10;
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
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    const label = sanitizePdfText(`${i + 1}.  ${f.label}`);
    const labelLines = doc.splitTextToSize(label, leftW - 5);
    labelLines.forEach((line: string) => {
      doc.text(line, leftX + 4, leftY);
      leftY += 4.1;
    });

    if (f.detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const detailLines = doc.splitTextToSize(sanitizePdfText(f.detail), leftW - 5);
      detailLines.slice(0, 3).forEach((line: string) => {
        doc.text(line, leftX + 4, leftY);
        leftY += 3.6;
      });
    }

    const blockH = leftY - blockTop + 1;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(leftX, blockTop - 3.2, 1.4, Math.max(blockH, 6), "F");
    leftY += 3.2;
  });

  // --- Right: framed image ---
  let imgBottom = colsTop;
  if (pack.imageDataUrl) {
    const framePad = 3;
    const captionReserve = 10;
    const maxImgH = Math.min(rightW * 1.05, bottom - colsTop - captionReserve - 8);
    const imgW = rightW - framePad * 2;
    const imgH = maxImgH;

    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.setLineWidth(0.35);
    doc.roundedRect(rightX, colsTop, rightW, imgH + framePad * 2 + 2, 2, 2, "FD");

    try {
      doc.addImage(
        pack.imageDataUrl,
        "JPEG",
        rightX + framePad,
        colsTop + framePad,
        imgW,
        imgH
      );
    } catch (e) {
      console.warn("diagnosticPack PDF image failed:", e);
    }

    imgBottom = colsTop + imgH + framePad * 2 + 2;
    const caption = sanitizePdfText(
      [pack.imageCaption, pack.imageSourceLabel].filter(Boolean).join(" · ")
    );
    if (caption) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      const capLines = doc.splitTextToSize(caption, rightW);
      let cy = imgBottom + 4;
      capLines.slice(0, 2).forEach((line: string) => {
        doc.text(line, rightX, cy);
        cy += 3.4;
      });
      imgBottom = cy;
    }
  }

  // --- Footer ---
  const footerY = Math.max(leftY, imgBottom) + 8;
  const fy = Math.min(footerY, bottom - 2);
  doc.setDrawColor(231, 229, 228);
  doc.setLineWidth(0.3);
  doc.line(marginX, fy, pageWidth - marginX, fy);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(120, 113, 108);
  const footer = sanitizePdfText(
    `Factores del informe que sustentan «${pack.diagnosis}» · ${factors.length} factor${
      factors.length === 1 ? "" : "es"
    }`
  );
  doc.text(footer, marginX, fy + 4.5);
}
