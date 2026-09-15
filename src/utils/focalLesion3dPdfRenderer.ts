import { FocalLesion3DData } from "../types";
import { sanitizeFocalClinicalProse } from "./sanitizeFocalClinicalProse";
import { pdfCutawayToCorte } from "./pdfCutawayToCorte";

/**
 * Annex for Focal Lesion Corte 3D — always ONE page.
 * Images on top; clinical boxes stacked full-width underneath (one under another).
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
  const bottomMargin = 12 * factor;
  const pageBottom = pageHeight - bottomMargin;

  doc.addPage();
  // Start below the global running header line drawn at y=14 on pages 2+
  let y = 22 * factor;

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CORTE FOCAL 3D DE LA LESIÓN", marginX, y);
  y += 4.5 * factor;

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5.5 * factor;

  const figTitle =
    data.figureTitle ||
    `FIGURA. DETALLE 3D DEL HALLAZGO: ${(data.lesionLabel || "LESIÓN FOCAL").toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 12 * factor).slice(0, 2);
  const figLineH = 3.7 * factor;
  const bannerH = Math.max(7.2 * factor, figTitleLines.length * figLineH + 3.2 * factor);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.6, 1.6, "FD");
  doc.setFillColor(13, 148, 136);
  doc.rect(marginX, y, 2.6 * factor, bannerH, "F");

  doc.setTextColor(30, 41, 59);
  let titleY = y + 4 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 6 * factor, titleY);
    titleY += figLineH;
  });
  y += bannerH + 2.4 * factor;

  // --- Meta chips ---
  const metaChips: { label: string; value: string }[] = [
    data.lesionLabel ? { label: "Lesión", value: data.lesionLabel } : null,
    data.lesionSite ? { label: "Sitio", value: data.lesionSite } : null,
    data.lesionSize ? { label: "Tamaño", value: data.lesionSize } : null,
    data.detectedLaterality ? { label: "Lateralidad", value: data.detectedLaterality } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (metaChips.length) {
    const chipGap = 1.6 * factor;
    const chipPadX = 2 * factor;
    const chipH = 5.8 * factor;
    let chipX = marginX;
    let chipY = y;
    for (const chip of metaChips) {
      const label = `${chip.label}: `;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6 * factor);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4 * factor);
      const value = String(chip.value || "").slice(0, 48);
      const valueW = doc.getTextWidth(value);
      const chipW = Math.min(contentWidth, labelW + valueW + chipPadX * 2 + 1 * factor);
      if (chipX + chipW > marginX + contentWidth + 0.01) {
        chipX = marginX;
        chipY += chipH + chipGap;
      }
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.roundedRect(chipX, chipY, chipW, chipH, 1.2, 1.2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6 * factor);
      doc.setTextColor(13, 148, 136);
      doc.text(label, chipX + chipPadX, chipY + 3.8 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4 * factor);
      doc.setTextColor(30, 41, 59);
      doc.text(value, chipX + chipPadX + labelW, chipY + 3.8 * factor);
      chipX += chipW + chipGap;
    }
    y = chipY + chipH + 2.2 * factor;
  }

  const figuresTop = y;

  // --- Stacked clinical boxes (full width, one under another) ---
  const summaryText = sanitizeFocalClinicalProse(data.lesionSummary || "");
  const morphologyText = sanitizeFocalClinicalProse(data.lesionMorphology || "");
  const relationsText = sanitizeFocalClinicalProse(data.lesionRelations || "");
  const keyPoints = Array.isArray(data.keyPoints)
    ? data.keyPoints
        .map((k) => sanitizeFocalClinicalProse(String(k || "")))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  type TextBox = { title: string; bodyLines: string[] };
  const textBoxes: TextBox[] = [];

  // Compact metrics so stacked boxes fit under figures on one page.
  // boxTitleH must clear title ascent + a visible gap before the first body baseline
  // (jsPDF y is baseline — too-small title blocks look "stuck" to the text).
  const boxPad = 2.4 * factor;
  const boxTitleH = 8.2 * factor;
  const boxLineH = 3.25 * factor;
  const boxGapMin = 2.2 * factor;
  const maxLinesPerBox = 4;

  const measureBoxBody = (raw: string): string[] => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    const lines = doc.splitTextToSize(raw, contentWidth - 11 * factor);
    if (lines.length <= maxLinesPerBox) return lines;
    const clipped = lines.slice(0, maxLinesPerBox);
    const last = String(clipped[maxLinesPerBox - 1] || "");
    clipped[maxLinesPerBox - 1] = (last.length > 4 ? last.slice(0, -3) : last) + "…";
    return clipped;
  };

  if (summaryText) textBoxes.push({ title: "Síntesis del hallazgo", bodyLines: measureBoxBody(summaryText) });
  if (morphologyText) textBoxes.push({ title: "Morfología", bodyLines: measureBoxBody(morphologyText) });
  if (relationsText) textBoxes.push({ title: "Relaciones anatómicas", bodyLines: measureBoxBody(relationsText) });
  if (keyPoints.length) {
    const kpLines: string[] = [];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    for (const kp of keyPoints) {
      const lines = doc.splitTextToSize(`• ${kp}`, contentWidth - 11 * factor);
      for (const line of lines) {
        if (kpLines.length >= maxLinesPerBox) break;
        kpLines.push(line);
      }
      if (kpLines.length >= maxLinesPerBox) break;
    }
    textBoxes.push({ title: "Puntos clave", bodyLines: kpLines });
  }

  const boxHeight = (box: TextBox) =>
    boxPad + boxTitleH + Math.max(1, box.bodyLines.length) * boxLineH + boxPad;

  const measureStackedH = (boxes: TextBox[], gap: number) => {
    if (!boxes.length) return 0;
    let total = 2 * factor; // gap under figures
    boxes.forEach((b, i) => {
      total += boxHeight(b) + (i < boxes.length - 1 ? gap : 0);
    });
    return total;
  };

  let boxes = [...textBoxes];
  let boxGap = boxGapMin;
  let reservedTextH = measureStackedH(boxes, boxGap);
  let availableForFigures = pageBottom - figuresTop - reservedTextH;

  // Prefer shrinking figures; if still impossible, drop least-critical boxes
  // (never open a second page).
  while (boxes.length > 1 && availableForFigures < 46 * factor) {
    const dropIdx =
      boxes.findIndex((b) => b.title === "Relaciones anatómicas") >= 0
        ? boxes.findIndex((b) => b.title === "Relaciones anatómicas")
        : boxes.findIndex((b) => b.title === "Puntos clave") >= 0
          ? boxes.findIndex((b) => b.title === "Puntos clave")
          : boxes.length - 1;
    boxes.splice(dropIdx, 1);
    reservedTextH = measureStackedH(boxes, boxGap);
    availableForFigures = pageBottom - figuresTop - reservedTextH;
  }

  availableForFigures = Math.max(40 * factor, availableForFigures);

  // If leftover space after images, distribute as extra gap between stacked boxes.
  // (Computed after figures are sized.)

  // --- Figures ---
  const numPanels = Math.min(validPanels.length, 2);
  const isSingle = numPanels === 1;
  const panelGap = isSingle ? 0 : 4 * factor;
  const cardPad = 1.8 * factor;
  const captionGap = 1.8 * factor;

  const measureCaption = (panelW: number): number => {
    let maxH = 0;
    for (let i = 0; i < numPanels; i++) {
      const p = validPanels[i];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6 * factor);
      const titleLines = doc
        .splitTextToSize(pdfCutawayToCorte(`${p.panelLetter}. ${p.panelTitle || ""}`), panelW - 4 * factor)
        .slice(0, 2);
      let h = captionGap + titleLines.length * 2.8 * factor;
      if (p.anatomicalFocus?.trim()) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8 * factor);
        const desc = doc
          .splitTextToSize(pdfCutawayToCorte(p.anatomicalFocus.trim()), panelW - 4 * factor)
          .slice(0, 2);
        h += 0.4 * factor + desc.length * 2.45 * factor;
      }
      h += 1.1 * factor;
      maxH = Math.max(maxH, h);
    }
    return Math.max(maxH, 5 * factor);
  };

  let panelWidth = isSingle ? contentWidth * 0.9 : (contentWidth - panelGap) / 2;
  let captionH = measureCaption(panelWidth);
  let imgW = panelWidth - cardPad * 2;
  let imgH = imgW * (3 / 4);
  let cardH = cardPad + imgH + captionH;

  if (cardH > availableForFigures) {
    imgH = Math.max(32 * factor, availableForFigures - captionH - cardPad);
    imgW = imgH * (4 / 3);
    panelWidth = imgW + cardPad * 2;
    captionH = measureCaption(panelWidth);
    cardH = cardPad + imgH + captionH;
    if (cardH > availableForFigures) {
      imgH = Math.max(28 * factor, availableForFigures - captionH - cardPad);
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
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, panelWidth, cardH, 1.5, 1.5, "FD");

    const imgX = cardX + cardPad;
    const imgY = y + cardPad;

    if (p.imageUrl && String(p.imageUrl).startsWith("data:image")) {
      try {
        const fmt = String(p.imageUrl).includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(p.imageUrl, fmt, imgX, imgY, imgW, imgH);
      } catch {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgW, imgH, "F");
      }
    }

    const badgeW = 18 * factor;
    const badgeH = 4 * factor;
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(imgX + 1.2, imgY + 1.2, badgeW, badgeH, 0.7, 0.7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    doc.setTextColor(255, 255, 255);
    const roleTag = p.panelRole === "macro" ? "MACRO" : "CTX";
    doc.text(`PANEL ${p.panelLetter} · ${roleTag}`, imgX + 2.1, imgY + 1.2 + 2.75);

    let textY = imgY + imgH + captionGap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6 * factor);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc
      .splitTextToSize(pdfCutawayToCorte(`${p.panelLetter}. ${p.panelTitle || ""}`), panelWidth - 4 * factor)
      .slice(0, 2);
    titleLines.forEach((line: string) => {
      doc.text(line, imgX + 0.4, textY);
      textY += 2.8 * factor;
    });
    if (p.anatomicalFocus?.trim()) {
      textY += 0.35 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(71, 85, 105);
      const desc = doc
        .splitTextToSize(pdfCutawayToCorte(p.anatomicalFocus.trim()), panelWidth - 4 * factor)
        .slice(0, 2);
      desc.forEach((line: string) => {
        doc.text(line, imgX + 0.4, textY);
        textY += 2.45 * factor;
      });
    }
  }

  y += cardH + 2.2 * factor;

  // Distribute leftover vertical space as gaps between stacked full-width boxes.
  if (boxes.length > 1) {
    const boxesOnlyH = boxes.reduce((acc, b) => acc + boxHeight(b), 0);
    const leftover = pageBottom - y - boxesOnlyH;
    if (leftover > 0) {
      const maxGap = 8 * factor;
      boxGap = Math.min(maxGap, Math.max(boxGapMin, leftover / (boxes.length - 1)));
    }
  }

  const drawStackedBox = (box: TextBox) => {
    const boxH = boxHeight(box);
    // Clamp — never addPage.
    if (y + boxH > pageBottom + 0.5 * factor) return false;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, contentWidth, boxH, 1.8, 1.8, "FD");
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(marginX, y, 1.8 * factor, boxH, 0.9, 0.9, "F");

    // Title baseline sits inside top padding; body starts after boxTitleH so the
    // gap under the title stays readable (~4–5pt clear air).
    const titleBaseline = y + boxPad + 3.6 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4 * factor);
    doc.setTextColor(15, 118, 110);
    doc.text(box.title, marginX + 5.5 * factor, titleBaseline);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    doc.setTextColor(51, 65, 85);
    let ty = y + boxPad + boxTitleH;
    box.bodyLines.forEach((line) => {
      doc.text(line, marginX + 5.5 * factor, ty);
      ty += boxLineH;
    });
    y += boxH + boxGap;
    return true;
  };

  for (const box of boxes) {
    if (!drawStackedBox(box)) break;
  }
}
