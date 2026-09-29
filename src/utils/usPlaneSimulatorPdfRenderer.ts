import { UsPlaneSimulatorData } from "../types";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * One-page PDF annex: US acquisition plane simulator (2 panels + short clinical strip).
 */
export function renderUsPlaneSimulatorAnnexToPDF(
  doc: any,
  data: UsPlaneSimulatorData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!data?.panels?.length) return;
  const valid = data.panels.filter((p) => p?.imageUrl);
  if (!valid.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 12 * factor;

  doc.addPage();
  let y = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: SIMULADOR DE PLANO ECOGRÁFICO 3D", marginX, y);
  y += 4.5 * factor;

  doc.setDrawColor(8, 145, 178);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5 * factor;

  const figTitle =
    data.figureTitle || "FIGURA. PLANO DE ADQUISICIÓN ECOGRÁFICA 3D";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  const titleLines = doc.splitTextToSize(sanitizePdfText(figTitle), contentWidth - 10 * factor).slice(0, 2);
  const bannerH = Math.max(7 * factor, titleLines.length * 3.6 * factor + 3 * factor);
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(165, 243, 252);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.5, 1.5, "FD");
  doc.setFillColor(8, 145, 178);
  doc.rect(marginX, y, 2.4 * factor, bannerH, "F");
  doc.setTextColor(30, 41, 59);
  let ty = y + 4 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 5.5 * factor, ty);
    ty += 3.6 * factor;
  });
  y += bannerH + 3 * factor;

  const meta = [
    data.planeLabelEs ? `Plano: ${data.planeLabelEs}` : "",
    data.detectedLaterality ? `Lado: ${data.detectedLaterality}` : "",
    data.targetStructure ? `Estructura: ${data.targetStructure}` : "",
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(meta).slice(0, 140), marginX, y);
    y += 5 * factor;
  }

  const n = Math.min(2, valid.length);
  const gap = 3.5 * factor;
  const imgW = (contentWidth - gap * (n - 1)) / n;
  const imgH = Math.min(72 * factor, imgW * 0.75);
  const startX = marginX;

  for (let i = 0; i < n; i++) {
    const p = valid[i];
    const x = startX + i * (imgW + gap);
    try {
      const fmt = String(p.imageUrl || "").includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(p.imageUrl, fmt, x, y, imgW, imgH);
    } catch {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, y, imgW, imgH, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text(`Panel ${p.panelLetter}`, x, y + imgH + 3.2 * factor);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8 * factor);
    doc.setTextColor(51, 65, 85);
    const cap = doc
      .splitTextToSize(sanitizePdfText(p.panelTitle || p.anatomicalFocus || ""), imgW)
      .slice(0, 2);
    doc.text(cap, x, y + imgH + 6.2 * factor);
  }

  y += imgH + 14 * factor;

  const summary = sanitizePdfText(data.planeSummary || "");
  if (summary && y < pageBottom - 20 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Síntesis del plano", marginX, y);
    y += 4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(summary, contentWidth).slice(0, 6);
    doc.text(lines, marginX, y);
    y += lines.length * 3.4 * factor + 3 * factor;
  }

  const crossed = (data.structuresCrossed || []).filter(Boolean);
  if (crossed.length && y < pageBottom - 12 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Estructuras cruzadas por el plano", marginX, y);
    y += 4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(30, 41, 59);
    const crossedText = sanitizePdfText(crossed.join(" · "));
    const maxLines = Math.max(2, Math.floor((pageBottom - y) / (3.4 * factor)));
    const crossedLines = doc.splitTextToSize(crossedText, contentWidth).slice(0, maxLines);
    doc.text(crossedLines, marginX, y);
  }
}
