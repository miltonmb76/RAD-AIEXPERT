import { FocalLesion3DData } from "../types";

/**
 * Thin Atlas-style annex for Focal Lesion Cutaway 3D (1–2 panels + lesion summary).
 */
export function renderFocalLesion3DAnnexToPDF(
  doc: any,
  data: FocalLesion3DData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!data || !data.panels || data.panels.length === 0) return;

  const validPanels = data.panels.filter((p) => p && p.imageUrl);
  if (validPanels.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;

  doc.addPage();
  let yCoord = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CORTE FOCAL 3D DE LA LESIÓN", marginX, yCoord);
  yCoord += 4.5 * factor;

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 7 * factor;

  const figTitle =
    data.figureTitle ||
    `FIGURA. DETALLE 3D DEL HALLAZGO: ${(data.lesionLabel || "LESIÓN FOCAL").toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 18 * factor);
  const figLineH = 4.8 * factor;
  const bannerHeight = Math.max(10 * factor, figTitleLines.length * figLineH + 6 * factor);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerHeight, 2, 2, "FD");

  doc.setFillColor(13, 148, 136);
  doc.rect(marginX, yCoord, 3.5 * factor, bannerHeight, "F");

  doc.setTextColor(30, 41, 59);
  let curTitleY = yCoord + 5.5 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, curTitleY);
    curTitleY += figLineH;
  });
  yCoord += bannerHeight + 5 * factor;

  const metaParts = [
    data.lesionLabel ? `Lesión: ${data.lesionLabel}` : "",
    data.lesionSite ? `Sitio: ${data.lesionSite}` : "",
    data.lesionSize ? `Tamaño: ${data.lesionSize}` : "",
    data.detectedLaterality ? `Lateralidad: ${data.detectedLaterality}` : "",
    data.detectionMode ? `Modo: ${data.detectionMode === "manual" ? "Manual" : "Auto"}` : ""
  ].filter(Boolean);
  if (metaParts.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8 * factor);
    doc.setTextColor(71, 85, 105);
    const metaLines = doc.splitTextToSize(metaParts.join("  ·  "), contentWidth);
    metaLines.forEach((line: string) => {
      doc.text(line, marginX, yCoord);
      yCoord += 3.6 * factor;
    });
    yCoord += 2 * factor;
  }

  const numPanels = Math.min(validPanels.length, 2);
  const panelGap = 6 * factor;
  const isSingle = numPanels === 1;
  const panelWidth = isSingle
    ? contentWidth * 0.58
    : (contentWidth - panelGap) / 2;
  const startX = isSingle ? marginX + (contentWidth - panelWidth) / 2 : marginX;
  const imgW = panelWidth - 4 * factor;
  const imgH = imgW * (3 / 4);

  const measureCaption = (p: (typeof validPanels)[0]): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    const titleLines = doc.splitTextToSize(
      `${p.panelLetter}. ${p.panelTitle || ""}`,
      panelWidth - 6 * factor
    );
    let h = 3.2 * factor + titleLines.length * 3.4 * factor;
    if (p.anatomicalFocus?.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2 * factor);
      const desc = doc.splitTextToSize(p.anatomicalFocus.trim(), panelWidth - 6 * factor);
      h += 1.0 * factor + desc.length * 3.05 * factor;
    }
    return h + 2.2 * factor;
  };
  const captionH = Math.max(...validPanels.slice(0, numPanels).map(measureCaption), 8 * factor);
  const cardH = imgH + captionH + 4 * factor;

  if (yCoord + cardH > pageHeight - 28 * factor) {
    doc.addPage();
    yCoord = 22 * factor;
  }

  for (let i = 0; i < numPanels; i++) {
    const p = validPanels[i];
    const cardX = startX + i * (panelWidth + panelGap);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, yCoord, panelWidth, cardH, 2, 2, "FD");

    const imgX = cardX + 2 * factor;
    const imgY = yCoord + 2 * factor;

    if (p.imageUrl && String(p.imageUrl).startsWith("data:image")) {
      try {
        const fmt = String(p.imageUrl).includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(p.imageUrl, fmt, imgX, imgY, imgW, imgH);
      } catch {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgW, imgH, "F");
      }
    }

    const badgeW = 22 * factor;
    const badgeH = 5 * factor;
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(imgX + 2, imgY + 2, badgeW, badgeH, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(255, 255, 255);
    const roleTag = p.panelRole === "macro" ? "MACRO" : "CTX";
    doc.text(`PANEL ${p.panelLetter} · ${roleTag}`, imgX + 3.2, imgY + 2 + 3.5);

    let textY = imgY + imgH + 3.2 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(
      `${p.panelLetter}. ${p.panelTitle || ""}`,
      panelWidth - 6 * factor
    );
    titleLines.forEach((line: string) => {
      doc.text(line, imgX + 1, textY);
      textY += 3.4 * factor;
    });
    if (p.anatomicalFocus?.trim()) {
      textY += 1.0 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(71, 85, 105);
      const desc = doc.splitTextToSize(p.anatomicalFocus.trim(), panelWidth - 6 * factor);
      desc.forEach((line: string) => {
        doc.text(line, imgX + 1, textY);
        textY += 3.05 * factor;
      });
    }
  }

  yCoord += cardH + 6 * factor;

  if (data.lesionSummary?.trim()) {
    if (yCoord + 20 * factor > pageHeight - 20 * factor) {
      doc.addPage();
      yCoord = 22 * factor;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("Síntesis del hallazgo focal", marginX, yCoord);
    yCoord += 4.5 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * factor);
    doc.setTextColor(51, 65, 85);
    const synLines = doc.splitTextToSize(data.lesionSummary.trim(), contentWidth);
    synLines.forEach((line: string) => {
      if (yCoord > pageHeight - 18 * factor) {
        doc.addPage();
        yCoord = 22 * factor;
      }
      doc.text(line, marginX, yCoord);
      yCoord += 3.8 * factor;
    });
  }

  if (Array.isArray(data.keyPoints) && data.keyPoints.length > 0) {
    yCoord += 3 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("Puntos clave", marginX, yCoord);
    yCoord += 4.5 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8 * factor);
    doc.setTextColor(51, 65, 85);
    for (const kp of data.keyPoints.slice(0, 6)) {
      const lines = doc.splitTextToSize(`• ${kp}`, contentWidth - 2 * factor);
      lines.forEach((line: string) => {
        if (yCoord > pageHeight - 18 * factor) {
          doc.addPage();
          yCoord = 22 * factor;
        }
        doc.text(line, marginX, yCoord);
        yCoord += 3.6 * factor;
      });
    }
  }
}
