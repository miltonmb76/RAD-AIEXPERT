import { FocalLesion3DData } from "../types";

/**
 * Annex for Focal Lesion Cutaway 3D.
 * Figures dominate the page while keeping 4:3 and equal panel sizing.
 * Two panels are stacked full-width (side-by-side cannot fill page height at 4:3).
 * Summary / keypoints use leftover space or spill to page 2.
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
  const pageBottom = pageHeight - 12 * factor;

  doc.addPage();
  let yCoord = 14 * factor;

  // --- Compact header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CORTE FOCAL 3D DE LA LESIÓN", marginX, yCoord);
  yCoord += 3.2 * factor;

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.65);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 3.8 * factor;

  const figTitle =
    data.figureTitle ||
    `FIGURA. DETALLE 3D DEL HALLAZGO: ${(data.lesionLabel || "LESIÓN FOCAL").toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 10 * factor).slice(0, 2);
  const figLineH = 3.5 * factor;
  const bannerH = Math.max(6.8 * factor, figTitleLines.length * figLineH + 2.8 * factor);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerH, 1.4, 1.4, "FD");
  doc.setFillColor(13, 148, 136);
  doc.rect(marginX, yCoord, 2.4 * factor, bannerH, "F");

  doc.setTextColor(30, 41, 59);
  let titleY = yCoord + 3.8 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 5.5 * factor, titleY);
    titleY += figLineH;
  });
  yCoord += bannerH + 2 * factor;

  const metaParts = [
    data.lesionLabel ? `Lesión: ${data.lesionLabel}` : "",
    data.lesionSite ? `Sitio: ${data.lesionSite}` : "",
    data.lesionSize ? `Tamaño: ${data.lesionSize}` : "",
    data.detectedLaterality ? `Lat.: ${data.detectedLaterality}` : "",
  ].filter(Boolean);
  if (metaParts.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8 * factor);
    doc.setTextColor(71, 85, 105);
    const metaLine = doc.splitTextToSize(metaParts.join("  ·  "), contentWidth)[0];
    if (metaLine) {
      doc.text(metaLine, marginX, yCoord);
      yCoord += 3 * factor;
    }
  }

  const figuresTop = yCoord;
  const summaryText = data.lesionSummary?.trim() || "";
  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints.filter(Boolean).slice(0, 5) : [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4 * factor);
  const summaryLines = summaryText ? doc.splitTextToSize(summaryText, contentWidth) : [];
  doc.setFontSize(7 * factor);
  const kpLinesTotal = keyPoints
    .map((kp: string) => doc.splitTextToSize(`• ${kp}`, contentWidth - 2 * factor).length)
    .reduce((a: number, b: number) => a + b, 0);

  let reservedTextH = 0;
  if (summaryText || keyPoints.length) {
    reservedTextH += 2.5 * factor;
    if (summaryText) reservedTextH += 3.4 * factor + summaryLines.length * 3.1 * factor;
    if (keyPoints.length) {
      reservedTextH += (summaryText ? 1.5 : 0) * factor + 3.4 * factor;
      reservedTextH += kpLinesTotal * 3.0 * factor;
    }
    reservedTextH += 1.2 * factor;
  }

  const usableH = pageBottom - figuresTop;
  let textOnSamePage = true;
  let availableForFigures = usableH - reservedTextH;

  const numPanels = Math.min(validPanels.length, 2);
  const isSingle = numPanels === 1;
  const cardPad = 1.4 * factor;
  const captionGap = 1.8 * factor;
  const sideGap = 3.5 * factor;
  const stackGap = 2.8 * factor;

  const measureCaption = (panelW: number, maxFocusLines: number): number => {
    let maxH = 0;
    for (let i = 0; i < numPanels; i++) {
      const p = validPanels[i];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      const titleLines = doc
        .splitTextToSize(`${p.panelLetter}. ${p.panelTitle || ""}`, panelW - 3.5 * factor)
        .slice(0, 2);
      let h = captionGap + titleLines.length * 2.75 * factor;
      if (p.anatomicalFocus?.trim() && maxFocusLines > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.4 * factor);
        const desc = doc
          .splitTextToSize(p.anatomicalFocus.trim(), panelW - 3.5 * factor)
          .slice(0, maxFocusLines);
        h += 0.4 * factor + desc.length * 2.45 * factor;
      }
      h += 1.0 * factor;
      maxH = Math.max(maxH, h);
    }
    return Math.max(maxH, 5 * factor);
  };

  // Two panels: stack full-width so 4:3 images can fill ~80% of the page.
  // Side-by-side 4:3 is width-capped (~half page) and leaves a large empty band.
  let mode: "side" | "stack" = isSingle ? "side" : "stack";
  let focusLines = isSingle ? 2 : 1;

  if (!isSingle && reservedTextH > 0) {
    textOnSamePage = false;
    availableForFigures = usableH - 1.2 * factor;
  } else if (isSingle && reservedTextH > 0 && availableForFigures < usableH * 0.78) {
    textOnSamePage = false;
    availableForFigures = usableH - 1.2 * factor;
  }

  let panelWidth = 0;
  let imgW = 0;
  let imgH = 0;
  let cardH = 0;

  if (mode === "stack") {
    // Cards always span full content width; 4:3 images shrink inside and stay centered.
    const gaps = stackGap * (numPanels - 1);
    const perCardBudget = (availableForFigures - gaps) / numPanels;
    panelWidth = contentWidth;
    let cap = measureCaption(panelWidth, focusLines);
    const maxIw = panelWidth - cardPad * 2;
    imgW = maxIw;
    imgH = imgW * (3 / 4);
    cardH = cardPad + imgH + cap;

    if (cardH > perCardBudget) {
      imgH = Math.max(52 * factor, perCardBudget - cap - cardPad);
      imgW = Math.min(maxIw, imgH * (4 / 3));
      imgH = imgW * (3 / 4);
      cardH = cardPad + imgH + cap;
      if (cardH > perCardBudget) {
        imgH = Math.max(46 * factor, perCardBudget - cap - cardPad);
        imgW = Math.min(maxIw, imgH * (4 / 3));
        imgH = imgW * (3 / 4);
        cardH = cardPad + imgH + cap;
      }
    }
  } else {
    // Single panel: maximize width, keep 4:3
    panelWidth = contentWidth * 0.98;
    let cap = measureCaption(panelWidth, focusLines);
    imgW = panelWidth - cardPad * 2;
    imgH = imgW * (3 / 4);
    cardH = cardPad + imgH + cap;
    if (cardH > availableForFigures) {
      imgH = Math.max(50 * factor, availableForFigures - cap - cardPad);
      imgW = imgH * (4 / 3);
      panelWidth = imgW + cardPad * 2;
      cap = measureCaption(panelWidth, focusLines);
      cardH = cardPad + imgH + cap;
      if (cardH > availableForFigures) {
        imgH = Math.max(44 * factor, availableForFigures - cap - cardPad);
        imgW = imgH * (4 / 3);
        panelWidth = imgW + cardPad * 2;
        cardH = cardPad + imgH + cap;
      }
    }
  }

  const drawCard = (p: (typeof validPanels)[0], cardX: number, cardY: number) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.28);
    doc.roundedRect(cardX, cardY, panelWidth, cardH, 1.4, 1.4, "FD");

    const imgX = cardX + (panelWidth - imgW) / 2;
    const imgY = cardY + cardPad;

    if (p.imageUrl && String(p.imageUrl).startsWith("data:image")) {
      try {
        const fmt = String(p.imageUrl).includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(p.imageUrl, fmt, imgX, imgY, imgW, imgH);
      } catch {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgW, imgH, "F");
      }
    } else {
      doc.setFillColor(241, 245, 249);
      doc.rect(imgX, imgY, imgW, imgH, "F");
    }

    const badgeW = 17 * factor;
    const badgeH = 3.9 * factor;
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(imgX + 1.1, imgY + 1.1, badgeW, badgeH, 0.6, 0.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5 * factor);
    doc.setTextColor(255, 255, 255);
    const roleTag = p.panelRole === "macro" ? "MACRO" : "CTX";
    doc.text(`PANEL ${p.panelLetter} · ${roleTag}`, imgX + 2, imgY + 1.1 + 2.7);

    let textY = imgY + imgH + captionGap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7 * factor);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc
      .splitTextToSize(`${p.panelLetter}. ${p.panelTitle || ""}`, panelWidth - 3.5 * factor)
      .slice(0, 2);
    titleLines.forEach((line: string) => {
      doc.text(line, cardX + 1.8 * factor, textY);
      textY += 2.75 * factor;
    });
    if (p.anatomicalFocus?.trim() && focusLines > 0) {
      textY += 0.35 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4 * factor);
      doc.setTextColor(71, 85, 105);
      const desc = doc
        .splitTextToSize(p.anatomicalFocus.trim(), panelWidth - 3.5 * factor)
        .slice(0, focusLines);
      desc.forEach((line: string) => {
        doc.text(line, cardX + 1.8 * factor, textY);
        textY += 2.45 * factor;
      });
    }
  };

  if (mode === "stack") {
    for (let i = 0; i < numPanels; i++) {
      const cardX = marginX + (contentWidth - panelWidth) / 2;
      const cardY = yCoord + i * (cardH + stackGap);
      drawCard(validPanels[i], cardX, cardY);
    }
    yCoord += numPanels * cardH + (numPanels - 1) * stackGap + 2.5 * factor;
  } else {
    const rowW = panelWidth;
    const startX = marginX + (contentWidth - rowW) / 2;
    drawCard(validPanels[0], startX, yCoord);
    yCoord += cardH + 2.5 * factor;
  }

  const ensureContinuationHeader = () => {
    doc.addPage();
    yCoord = 16 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("ANEXO: CORTE FOCAL 3D (continuación)", marginX, yCoord);
    yCoord += 5 * factor;
  };

  const drawTextBlock = () => {
    if (summaryText) {
      if (yCoord + 9 * factor > pageBottom) ensureContinuationHeader();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("Síntesis del hallazgo focal", marginX, yCoord);
      yCoord += 3.3 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4 * factor);
      doc.setTextColor(51, 65, 85);
      summaryLines.forEach((line: string) => {
        if (yCoord > pageBottom - 3.2 * factor) ensureContinuationHeader();
        doc.text(line, marginX, yCoord);
        yCoord += 3.1 * factor;
      });
    }

    if (keyPoints.length) {
      yCoord += summaryText ? 1.5 * factor : 0;
      if (yCoord + 7 * factor > pageBottom) ensureContinuationHeader();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("Puntos clave", marginX, yCoord);
      yCoord += 3.3 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7 * factor);
      doc.setTextColor(51, 65, 85);
      for (const kp of keyPoints) {
        const lines = doc.splitTextToSize(`• ${kp}`, contentWidth - 2 * factor);
        lines.forEach((line: string) => {
          if (yCoord > pageBottom - 3.2 * factor) ensureContinuationHeader();
          doc.text(line, marginX, yCoord);
          yCoord += 3.0 * factor;
        });
      }
    }
  };

  if (summaryText || keyPoints.length) {
    if (!textOnSamePage) ensureContinuationHeader();
    drawTextBlock();
  }
}
