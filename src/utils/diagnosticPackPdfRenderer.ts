import type { DiagnosticPackData } from "../lib/diagnosticPack";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * One-page clinician pack: diagnosis ancla + justifying factors + optional 3D/focal image.
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
  if (!pack || !String(pack.diagnosis || "").trim()) return;

  const pageWidth = options?.pageWidth ?? doc.internal.pageSize.getWidth();
  const pageHeight = options?.pageHeight ?? doc.internal.pageSize.getHeight();
  const marginX = options?.marginX ?? 14;
  const contentWidth = pageWidth - marginX * 2;

  doc.addPage();
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: PACK DE JUSTIFICACIÓN DIAGNÓSTICA", marginX, y);
  y += 5;

  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // Anchor banner
  const dx = sanitizePdfText(pack.diagnosis);
  const dxLines = doc.splitTextToSize(dx, contentWidth - 12);
  const bannerH = Math.max(16, dxLines.length * 5.5 + 10);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(217, 119, 6);
  doc.rect(marginX, y, 3.2, bannerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14);
  doc.text("DIAGNÓSTICO ANCLA", marginX + 7, y + 5);
  doc.setFontSize(12);
  doc.setTextColor(28, 25, 23);
  let ty = y + 11;
  dxLines.forEach((line: string) => {
    doc.text(line, marginX + 7, ty);
    ty += 5.5;
  });
  y += bannerH + 6;

  if (pack.categoryLabel || pack.studyRegion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const meta = [pack.categoryLabel, pack.studyRegion].filter(Boolean).join("  ·  ");
    doc.text(sanitizePdfText(meta), marginX, y);
    y += 6;
  }

  // Two-column layout when image exists
  const hasImage = Boolean(pack.imageDataUrl);
  const colGap = 6;
  const leftW = hasImage ? contentWidth * 0.52 : contentWidth;
  const rightW = contentWidth - leftW - colGap;
  const leftX = marginX;
  const rightX = marginX + leftW + colGap;
  const topY = y;

  if (pack.synthesis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const synLines = doc.splitTextToSize(sanitizePdfText(pack.synthesis), leftW);
    synLines.forEach((line: string) => {
      doc.text(line, leftX, y);
      y += 4.2;
    });
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text("FACTORES DE SOPORTE", leftX, y);
  y += 5;

  const factors = (pack.factors || []).slice(0, 7);
  factors.forEach((f, i) => {
    const label = sanitizePdfText(`${i + 1}. ${f.label}`);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const labelLines = doc.splitTextToSize(label, leftW);
    labelLines.forEach((line: string) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 18;
      }
      doc.text(line, leftX, y);
      y += 4.3;
    });
    if (f.detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const detailLines = doc.splitTextToSize(sanitizePdfText(f.detail), leftW);
      detailLines.forEach((line: string) => {
        doc.text(line, leftX, y);
        y += 3.8;
      });
    }
    y += 2.5;
  });

  if (hasImage && pack.imageDataUrl) {
    try {
      const imgW = rightW;
      const imgH = Math.min(imgW * 0.85, pageHeight - topY - 24);
      doc.addImage(pack.imageDataUrl, "JPEG", rightX, topY, imgW, imgH);
      if (pack.imageCaption) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const cap = doc.splitTextToSize(sanitizePdfText(pack.imageCaption), rightW);
        doc.text(cap, rightX, topY + imgH + 4);
      }
    } catch (e) {
      console.warn("diagnosticPack PDF image failed:", e);
    }
  }
}
