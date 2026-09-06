import { FocalLesion3DData } from "../types";

/**
 * Atlas-style annex for Focal Lesion Cutaway 3D.
 * Side-by-side annex (4:3, equal panels) with slightly larger typography.
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
  const bottomMargin = 16 * factor;
  const pageBottom = pageHeight - bottomMargin;

  doc.addPage();
  let yCoord = 20 * factor;

  // --- Header (compact) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CORTE FOCAL 3D DE LA LESIÓN", marginX, yCoord);
  yCoord += 4 * factor;

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.75);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 5.5 * factor;

  const figTitle =
    data.figureTitle ||
    `FIGURA. DETALLE 3D DEL HALLAZGO: ${(data.lesionLabel || "LESIÓN FOCAL").toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 14 * factor);
  const figLineH = 4.2 * factor;
  const bannerHeight = Math.max(8.5 * factor, figTitleLines.length * figLineH + 4.5 * factor);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerHeight, 1.8, 1.8, "FD");
  doc.setFillColor(13, 148, 136);
  doc.rect(marginX, yCoord, 3 * factor, bannerHeight, "F");

  doc.setTextColor(30, 41, 59);
  let curTitleY = yCoord + 4.8 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, curTitleY);
    curTitleY += figLineH;
  });
  yCoord += bannerHeight + 3.5 * factor;

  // --- Meta strip (one compact line when possible) ---
  const metaParts = [
    data.lesionLabel ? `Lesión: ${data.lesionLabel}` : "",
    data.lesionSite ? `Sitio: ${data.lesionSite}` : "",
    data.lesionSize ? `Tamaño: ${data.lesionSize}` : "",
    data.detectedLaterality ? `Lateralidad: ${data.detectedLaterality}` : "",
    data.detectionMode ? `Modo: ${data.detectionMode === "manual" ? "Manual" : "Auto"}` : ""
  ].filter(Boolean);
  if (metaParts.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9 * factor);
    doc.setTextColor(71, 85, 105);
    const metaLines = doc.splitTextToSize(metaParts.join("  ·  "), contentWidth);
    metaLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, marginX, yCoord);
      yCoord += 3.3 * factor;
    });
    yCoord += 1.5 * factor;
  }

  const figuresTop = yCoord;

  // --- Reserve footer text (summary + keypoints) so figures can grow into leftover space ---
  const summaryText = data.lesionSummary?.trim() || "";
  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints.filter(Boolean).slice(0, 6) : [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9 * factor);
  const summaryLines = summaryText
    ? doc.splitTextToSize(summaryText, contentWidth)
    : [];
  doc.setFontSize(8.6 * factor);
  const keyPointLineCounts = keyPoints.map((kp: string) =>
    doc.splitTextToSize(`• ${kp}`, contentWidth - 2 * factor).length
  );
  const keyPointsLinesTotal = keyPointLineCounts.reduce((a: number, b: number) => a + b, 0);

  let reservedTextH = 0;
  if (summaryText || keyPoints.length) {
    reservedTextH += 4 * factor; // gap under figures
    if (summaryText) {
      reservedTextH += 4.2 * factor; // section title
      reservedTextH += summaryLines.length * 3.6 * factor;
    }
    if (keyPoints.length) {
      reservedTextH += (summaryText ? 2.5 : 0) * factor + 4.2 * factor;
      reservedTextH += keyPointsLinesTotal * 3.4 * factor;
    }
    reservedTextH += 2 * factor;
  }

  // Prefer keeping text on the same page; if text is huge, allow figures more room
  // and spill text to a continuation page.
  const minFigureBudget = 78 * factor;
  let textOnSamePage = true;
  let availableForFigures = pageBottom - figuresTop - reservedTextH;
  if (availableForFigures < minFigureBudget && reservedTextH > 0) {
    textOnSamePage = false;
    availableForFigures = pageBottom - figuresTop - 2 * factor;
  }

  // --- Figure block: maximize width/height, keep 4:3 and equal panels ---
  const numPanels = Math.min(validPanels.length, 2);
  const isSingle = numPanels === 1;
  const panelGap = isSingle ? 0 : 5 * factor;
  const cardPad = 2 * factor;
  const captionGap = 2.6 * factor;

  // Caption height estimate (tight, shared across panels so cards stay equal)
  const measureCaption = (panelW: number): number => {
    let maxH = 0;
    for (let i = 0; i < numPanels; i++) {
      const p = validPanels[i];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6 * factor);
      const titleLines = doc.splitTextToSize(
        `${p.panelLetter}. ${p.panelTitle || ""}`,
        panelW - 5 * factor
      );
      let h = captionGap + titleLines.length * 3.2 * factor;
      if (p.anatomicalFocus?.trim()) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.8 * factor);
        const desc = doc.splitTextToSize(p.anatomicalFocus.trim(), panelW - 5 * factor);
        // Cap caption lines so figures can stay large
        const capped = desc.slice(0, 3);
        h += 0.8 * factor + capped.length * 2.9 * factor;
      }
      h += 1.8 * factor;
      maxH = Math.max(maxH, h);
    }
    return Math.max(maxH, 7 * factor);
  };

  // Max panel width from page width
  const maxPanelWFromWidth = isSingle
    ? contentWidth * 0.92
    : (contentWidth - panelGap) / 2;

  // Iterate once with provisional caption, then refine
  let panelWidth = maxPanelWFromWidth;
  let captionH = measureCaption(panelWidth);
  let imgW = panelWidth - cardPad * 2;
  let imgH = imgW * (3 / 4);
  let cardH = cardPad + imgH + captionH;

  // If card is taller than budget, shrink by height while keeping 4:3
  if (cardH > availableForFigures) {
    const maxImgH = Math.max(40 * factor, availableForFigures - captionH - cardPad);
    imgH = maxImgH;
    imgW = imgH * (4 / 3);
    panelWidth = imgW + cardPad * 2;
    // Re-measure caption at new width (may shrink slightly)
    captionH = measureCaption(panelWidth);
    cardH = cardPad + imgH + captionH;
    // If caption grew and overflows, trim img a bit more
    if (cardH > availableForFigures) {
      imgH = Math.max(36 * factor, availableForFigures - captionH - cardPad);
      imgW = imgH * (4 / 3);
      panelWidth = imgW + cardPad * 2;
      cardH = cardPad + imgH + captionH;
    }
  }

  // Never exceed content width after height-driven sizing
  const maxRowW = isSingle ? contentWidth : contentWidth;
  const rowW = isSingle ? panelWidth : panelWidth * 2 + panelGap;
  if (rowW > maxRowW + 0.01) {
    const scale = maxRowW / rowW;
    panelWidth *= scale;
    imgW = panelWidth - cardPad * 2;
    imgH = imgW * (3 / 4);
    captionH = measureCaption(panelWidth);
    cardH = cardPad + imgH + captionH;
  }

  const startX = isSingle
    ? marginX + (contentWidth - panelWidth) / 2
    : marginX + (contentWidth - (panelWidth * numPanels + panelGap * (numPanels - 1))) / 2;

  for (let i = 0; i < numPanels; i++) {
    const p = validPanels[i];
    const cardX = startX + i * (panelWidth + panelGap);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(cardX, yCoord, panelWidth, cardH, 1.8, 1.8, "FD");

    const imgX = cardX + cardPad;
    const imgY = yCoord + cardPad;

    if (p.imageUrl && String(p.imageUrl).startsWith("data:image")) {
      try {
        const fmt = String(p.imageUrl).includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(p.imageUrl, fmt, imgX, imgY, imgW, imgH);
      } catch {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgW, imgH, "F");
      }
    }

    const badgeW = 20 * factor;
    const badgeH = 4.6 * factor;
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(imgX + 1.5, imgY + 1.5, badgeW, badgeH, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7 * factor);
    doc.setTextColor(255, 255, 255);
    const roleTag = p.panelRole === "macro" ? "MACRO" : "CTX";
    doc.text(`PANEL ${p.panelLetter} · ${roleTag}`, imgX + 2.6, imgY + 1.5 + 3.2);

    let textY = imgY + imgH + captionGap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6 * factor);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(
      `${p.panelLetter}. ${p.panelTitle || ""}`,
      panelWidth - 5 * factor
    );
    titleLines.forEach((line: string) => {
      doc.text(line, imgX + 0.5, textY);
      textY += 3.2 * factor;
    });
    if (p.anatomicalFocus?.trim()) {
      textY += 0.8 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8 * factor);
      doc.setTextColor(71, 85, 105);
      const desc = doc.splitTextToSize(p.anatomicalFocus.trim(), panelWidth - 5 * factor).slice(0, 3);
      desc.forEach((line: string) => {
        doc.text(line, imgX + 0.5, textY);
        textY += 2.9 * factor;
      });
    }
  }

  yCoord += cardH + 4 * factor;

  const drawTextBlock = () => {
    if (summaryText) {
      if (yCoord + 12 * factor > pageBottom) {
        doc.addPage();
        yCoord = 22 * factor;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11 * factor);
        doc.setTextColor(15, 23, 42);
        doc.text("ANEXO: CORTE FOCAL 3D (continuación)", marginX, yCoord);
        yCoord += 6 * factor;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("Síntesis del hallazgo focal", marginX, yCoord);
      yCoord += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9 * factor);
      doc.setTextColor(51, 65, 85);
      summaryLines.forEach((line: string) => {
        if (yCoord > pageBottom - 4 * factor) {
          doc.addPage();
          yCoord = 22 * factor;
        }
        doc.text(line, marginX, yCoord);
        yCoord += 3.6 * factor;
      });
    }

    if (keyPoints.length) {
      yCoord += summaryText ? 2.5 * factor : 0;
      if (yCoord + 10 * factor > pageBottom) {
        doc.addPage();
        yCoord = 22 * factor;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("Puntos clave", marginX, yCoord);
      yCoord += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.6 * factor);
      doc.setTextColor(51, 65, 85);
      for (const kp of keyPoints) {
        const lines = doc.splitTextToSize(`• ${kp}`, contentWidth - 2 * factor);
        lines.forEach((line: string) => {
          if (yCoord > pageBottom - 4 * factor) {
            doc.addPage();
            yCoord = 22 * factor;
          }
          doc.text(line, marginX, yCoord);
          yCoord += 3.4 * factor;
        });
      }
    }
  };

  if (summaryText || keyPoints.length) {
    if (!textOnSamePage) {
      doc.addPage();
      yCoord = 22 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("ANEXO: CORTE FOCAL 3D (continuación)", marginX, yCoord);
      yCoord += 6 * factor;
    }
    drawTextBlock();
  }
}
