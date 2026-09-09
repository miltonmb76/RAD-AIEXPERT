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

  // --- Clinical meta chips (no detection mode) ---
  const metaChips: { label: string; value: string }[] = [
    data.lesionLabel ? { label: "Lesión", value: data.lesionLabel } : null,
    data.lesionSite ? { label: "Sitio", value: data.lesionSite } : null,
    data.lesionSize ? { label: "Tamaño", value: data.lesionSize } : null,
    data.detectedLaterality ? { label: "Lateralidad", value: data.detectedLaterality } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (metaChips.length) {
    const chipGap = 2.2 * factor;
    const chipPadX = 2.4 * factor;
    const chipH = 7.2 * factor;
    let chipX = marginX;
    let chipY = yCoord;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4 * factor);
    for (const chip of metaChips) {
      const label = `${chip.label}: `;
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4 * factor);
      const valueLines = doc.splitTextToSize(chip.value, contentWidth * 0.42);
      const valueW = Math.max(...valueLines.map((l: string) => doc.getTextWidth(l)));
      const chipW = Math.min(contentWidth, labelW + valueW + chipPadX * 2 + 1.5 * factor);
      if (chipX + chipW > marginX + contentWidth + 0.01) {
        chipX = marginX;
        chipY += chipH + chipGap;
      }
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(chipX, chipY, chipW, chipH, 1.4, 1.4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4 * factor);
      doc.setTextColor(13, 148, 136);
      doc.text(label, chipX + chipPadX, chipY + 4.6 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4 * factor);
      doc.setTextColor(30, 41, 59);
      doc.text(valueLines[0], chipX + chipPadX + labelW, chipY + 4.6 * factor);
      chipX += chipW + chipGap;
    }
    yCoord = chipY + chipH + 3.2 * factor;
  }

  const figuresTop = yCoord;

  // --- Clinical text blocks to reserve under figures ---
  const summaryText = (data.lesionSummary || "").trim();
  const morphologyText = (data.lesionMorphology || "").trim();
  const relationsText = (data.lesionRelations || "").trim();
  const keyPoints = Array.isArray(data.keyPoints)
    ? data.keyPoints.map((k) => String(k || "").trim()).filter(Boolean).slice(0, 8)
    : [];

  type TextBox = { title: string; bodyLines: string[]; bullet?: boolean };
  const textBoxes: TextBox[] = [];

  const measureBoxBody = (raw: string, bullet = false): string[] => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4 * factor);
    const prefix = bullet ? "• " : "";
    return doc.splitTextToSize(`${prefix}${raw}`, contentWidth - 10 * factor);
  };

  if (summaryText) {
    textBoxes.push({ title: "Síntesis del hallazgo", bodyLines: measureBoxBody(summaryText) });
  }
  if (morphologyText) {
    textBoxes.push({ title: "Morfología", bodyLines: measureBoxBody(morphologyText) });
  }
  if (relationsText) {
    textBoxes.push({ title: "Relaciones anatómicas", bodyLines: measureBoxBody(relationsText) });
  }
  if (keyPoints.length) {
    const kpLines: string[] = [];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2 * factor);
    for (const kp of keyPoints) {
      const lines = doc.splitTextToSize(`• ${kp}`, contentWidth - 10 * factor);
      kpLines.push(...lines);
    }
    textBoxes.push({ title: "Puntos clave", bodyLines: kpLines, bullet: true });
  }

  // Title baseline + descent + gap before first body baseline (avoids title/body overlap).
  const boxTitleH = 8.4 * factor;
  const boxPad = 3.4 * factor;
  const boxLineH = 4 * factor;
  const boxGap = 3.2 * factor;
  let reservedTextH = 0;
  if (textBoxes.length) {
    reservedTextH += 3.5 * factor;
    for (const box of textBoxes) {
      reservedTextH += boxPad + boxTitleH + box.bodyLines.length * boxLineH + boxPad + boxGap;
    }
  }

  // Prefer text on same page; if too tall, give figures more room and continue text later.
  const minFigureBudget = 72 * factor;
  let textOnSamePage = true;
  let availableForFigures = pageBottom - figuresTop - reservedTextH;
  if (availableForFigures < minFigureBudget && reservedTextH > 0) {
    textOnSamePage = false;
    availableForFigures = pageBottom - figuresTop - 2 * factor;
  }

  // --- Figure block (unchanged drawing approach: equal 4:3 panels) ---
  const numPanels = Math.min(validPanels.length, 2);
  const isSingle = numPanels === 1;
  const panelGap = isSingle ? 0 : 5 * factor;
  const cardPad = 2 * factor;
  const captionGap = 2.6 * factor;

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
        const desc = doc.splitTextToSize(p.anatomicalFocus.trim(), panelW - 5 * factor).slice(0, 3);
        h += 0.8 * factor + desc.length * 2.9 * factor;
      }
      h += 1.8 * factor;
      maxH = Math.max(maxH, h);
    }
    return Math.max(maxH, 7 * factor);
  };

  const maxPanelWFromWidth = isSingle
    ? contentWidth * 0.92
    : (contentWidth - panelGap) / 2;

  let panelWidth = maxPanelWFromWidth;
  let captionH = measureCaption(panelWidth);
  let imgW = panelWidth - cardPad * 2;
  let imgH = imgW * (3 / 4);
  let cardH = cardPad + imgH + captionH;

  if (cardH > availableForFigures) {
    const maxImgH = Math.max(40 * factor, availableForFigures - captionH - cardPad);
    imgH = maxImgH;
    imgW = imgH * (4 / 3);
    panelWidth = imgW + cardPad * 2;
    captionH = measureCaption(panelWidth);
    cardH = cardPad + imgH + captionH;
    if (cardH > availableForFigures) {
      imgH = Math.max(36 * factor, availableForFigures - captionH - cardPad);
      imgW = imgH * (4 / 3);
      panelWidth = imgW + cardPad * 2;
      cardH = cardPad + imgH + captionH;
    }
  }

  const rowW = isSingle ? panelWidth : panelWidth * 2 + panelGap;
  if (rowW > contentWidth + 0.01) {
    const scale = contentWidth / rowW;
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

  const ensureSpace = (needed: number) => {
    if (yCoord + needed <= pageBottom) return;
    doc.addPage();
    yCoord = 20 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("ANEXO: CORTE FOCAL 3D (continuación)", marginX, yCoord);
    yCoord += 7 * factor;
  };

  const drawElegantBox = (title: string, bodyLines: string[]) => {
    const boxH = boxPad + boxTitleH + bodyLines.length * boxLineH + boxPad;
    ensureSpace(boxH + 2 * factor);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginX, yCoord, contentWidth, boxH, 2.2, 2.2, "FD");
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(marginX, yCoord, 2.2 * factor, boxH, 1.1, 1.1, "F");

    // jsPDF y is baseline: keep title ascent inside padding, then clear gap to body.
    const titleBaseline = yCoord + boxPad + 3.6 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10 * factor);
    doc.setTextColor(15, 118, 110);
    doc.text(title, marginX + 6 * factor, titleBaseline);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4 * factor);
    doc.setTextColor(51, 65, 85);
    let ty = yCoord + boxPad + boxTitleH;
    bodyLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, ty);
      ty += boxLineH;
    });
    yCoord += boxH + boxGap;
  };

  const drawTextBlocks = () => {
    for (const box of textBoxes) {
      drawElegantBox(box.title, box.bodyLines);
    }
  };

  if (textBoxes.length) {
    if (!textOnSamePage) {
      doc.addPage();
      yCoord = 20 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("ANEXO: CORTE FOCAL 3D (continuación)", marginX, yCoord);
      yCoord += 7 * factor;
    }
    drawTextBlocks();
  }
}
