import { Atlas3DData } from "../types";

export function renderAtlas3DAnnexToPDF(
  doc: any,
  atlasData: Atlas3DData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!atlasData || !atlasData.panels || atlasData.panels.length === 0) {
    return;
  }

  // Filter panels that have valid image data
  const validPanels = atlasData.panels.filter(p => p && p.imageUrl);
  if (validPanels.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;

  // Add dedicated exclusive page
  doc.addPage();
  
  // Start comfortably below running header line (y=14)
  let yCoord = 22 * factor;

  // 1. TOP HEADER (Medical Atlas Style)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ANEXO: ATLAS 3D FOTORREALISTA Y CORRELACIÓN ANATÓMICA", marginX, yCoord);
  yCoord += 4.5 * factor;

  // Top Accent Line (Indigo gradient representation)
  doc.setDrawColor(99, 102, 241); // Indigo-500
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 7 * factor;

  // 2. FIGURE TITLE BANNER (Elegantly styled box with left purple accent)
  const regionLabel = atlasData.studyRegion || "Región Anatómica Evaluada";
  const figTitle = atlasData.figureTitle || `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN ULTRASONOGRÁFICA DE ${regionLabel.toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 18 * factor);
  const figLineH = 4.8 * factor;
  const bannerHeight = Math.max(10 * factor, figTitleLines.length * figLineH + 6 * factor);

  // Banner background
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerHeight, 2, 2, "FD");

  // Left accent bar
  doc.setFillColor(99, 102, 241); // Indigo 500
  doc.rect(marginX, yCoord, 3.5 * factor, bannerHeight, "F");

  // Title Text
  doc.setTextColor(30, 41, 59); // slate-800
  let curTitleY = yCoord + 5.5 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, curTitleY);
    curTitleY += figLineH;
  });
  yCoord += bannerHeight + 6 * factor;

  // 3. 3D PANELS GRID (1, 2 or 3 columns)
  const numPanels = validPanels.length;
  const isSinglePanel = numPanels === 1;
  const panelGap = (numPanels === 2 ? 6 : 4) * factor;
  let panelWidth = isSinglePanel
    ? contentWidth * 0.44
    : (contentWidth - panelGap * (numPanels - 1)) / numPanels;
  let singlePanelX = isSinglePanel ? marginX + (contentWidth - panelWidth) / 2 : marginX;

  // Calculate proportional heights (Header + 4:3 Image Container + Caption)
  const cardHeaderH = (numPanels === 2 || isSinglePanel ? 8.5 : 7.5) * factor;
  let imgBoxH = panelWidth * 0.75; // Exact 4:3 aspect ratio
  if (isSinglePanel) {
    const maxSingleImgH = 50 * factor;
    if (imgBoxH > maxSingleImgH) {
      imgBoxH = maxSingleImgH;
      panelWidth = imgBoxH / 0.75;
      singlePanelX = marginX + (contentWidth - panelWidth) / 2;
    }
  }

  // Pre-calculate captions to ensure exact height fitting and no text overflow
  doc.setFont("helvetica", "normal");
  const captionFontSize = (numPanels === 2 || isSinglePanel ? 8 : 7.2) * factor;
  doc.setFontSize(captionFontSize);
  const captionLineH = (numPanels === 2 || isSinglePanel ? 4.2 : 3.8) * factor;

  const panelCalculatedData = validPanels.map((panel) => {
    const focusText = panel.anatomicalFocus ? panel.anatomicalFocus.replace(/^Foco:\s*/i, "") : "Reconstrucción tridimensional";
    const focusAvailableWidth = panelWidth - (numPanels === 2 || isSinglePanel ? 18 : 14) * factor;
    const focusLines = doc.splitTextToSize(focusText, focusAvailableWidth);
    return {
      focusText,
      focusLines,
      lineCount: Math.max(focusLines.length, 1)
    };
  });

  const maxCaptionLines = Math.max(...panelCalculatedData.map(p => p.lineCount), 2);
  const captionH = Math.max(14 * factor, maxCaptionLines * captionLineH + 8 * factor);
  const totalPanelCardH = cardHeaderH + imgBoxH + captionH;

  for (let i = 0; i < numPanels; i++) {
    const panel = validPanels[i];
    const calcData = panelCalculatedData[i];
    const panelX = isSinglePanel ? singlePanelX : marginX + i * (panelWidth + panelGap);

    // Card Outer Box
    doc.setFillColor(15, 23, 42); // slate-900
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.4);
    doc.roundedRect(panelX, yCoord, panelWidth, totalPanelCardH, 2.5, 2.5, "FD");

    // Card Header (Violet banner with Panel Letter)
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.roundedRect(panelX, yCoord, panelWidth, cardHeaderH, 2.5, 2.5, "F");
    // Flatten bottom corners of header
    doc.rect(panelX, yCoord + cardHeaderH - 2.5, panelWidth, 2.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize((numPanels === 2 || isSinglePanel ? 8.5 : 7.5) * factor);
    doc.setTextColor(255, 255, 255);
    const panelHeaderTitle = `PANEL ${panel.panelLetter}: ${panel.panelTitle || ""}`;
    const headerTitleLines = doc.splitTextToSize(panelHeaderTitle, panelWidth - 6 * factor);
    doc.text(headerTitleLines[0] || panelHeaderTitle, panelX + 3.5 * factor, yCoord + 5.5 * factor);

    // Image Placement inside white/clean container maintaining exact 4:3 aspect ratio
    const imgY = yCoord + cardHeaderH;
    doc.setFillColor(255, 255, 255);
    doc.rect(panelX, imgY, panelWidth, imgBoxH, "F");

    try {
      if (panel.imageUrl) {
        let cleanB64 = panel.imageUrl;
        let format = "JPEG";
        if (cleanB64.startsWith("data:image/png")) format = "PNG";
        if (cleanB64.startsWith("data:image/webp")) format = "WEBP";
        
        const imgInset = 0.4 * factor;
        doc.addImage(
          cleanB64,
          format,
          panelX + imgInset,
          imgY + imgInset,
          panelWidth - imgInset * 2,
          imgBoxH - imgInset * 2,
          undefined,
          "FAST"
        );
      }
    } catch (imgError) {
      console.warn("Error rendering panel image in PDF:", imgError);
    }

    // Caption Footer (Dark bottom box with Foco: description)
    const captionY = imgY + imgBoxH;
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(panelX, captionY, panelWidth, captionH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(captionFontSize);
    doc.setTextColor(165, 180, 252); // indigo-300
    const focoLabelX = panelX + 3.5 * factor;
    doc.text("Foco:", focoLabelX, captionY + 5.2 * factor);

    const focoLabelWidth = doc.getTextWidth("Foco:") + 2 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(captionFontSize);
    doc.setTextColor(241, 245, 249); // slate-100
    
    let curLineY = captionY + 5.2 * factor;
    calcData.focusLines.forEach((l: string, lIdx: number) => {
      // First line indented after "Foco:", subsequent lines aligned
      const textX = lIdx === 0 ? focoLabelX + focoLabelWidth : focoLabelX;
      doc.text(l, textX, curLineY);
      curLineY += captionLineH;
    });
  }

  yCoord += totalPanelCardH + 7 * factor;

  // 4. SYNOPTIC CORRELATION TABLE
  const synopticRows = (atlasData.synopticExplanation || atlasData.synopticTable || []);
  if (synopticRows.length > 0) {
    // Section Header with stylized vector square icon (No unicode character that causes %)
    doc.setFillColor(99, 102, 241); // Indigo-500
    doc.roundedRect(marginX, yCoord - 3.2 * factor, 3.8 * factor, 3.8 * factor, 0.8, 0.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("CORRELACIÓN SEMIOLÓGICA DE HALLAZGOS EN RECONSTRUCCIÓN 3D", marginX + 6 * factor, yCoord);
    yCoord += 5.5 * factor;

    // Table Column Widths — fixed panel column avoids header/body overlap
    const colRefW = 18 * factor;
    const colStructureW = contentWidth * 0.26;
    const colDescW = contentWidth - colStructureW - colRefW;
    const colStructureX = marginX;
    const colRefX = marginX + colStructureW;
    const colDescX = marginX + colStructureW + colRefW;

    const formatPanelRefForPdf = (panelRef?: string): string => {
      const raw = (panelRef || "(Panel A)").trim();
      const single = raw.match(/Panel\s+([A-C])/i);
      if (single) return single[1].toUpperCase();
      return raw.replace(/[()]/g, "").replace(/^Panel\s+/i, "P. ");
    };

    // Table Header Row
    const tableHeaderH = 8 * factor;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.35);
    doc.rect(marginX, yCoord, contentWidth, tableHeaderH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text("ESTRUCTURA / FOCO", colStructureX + 4 * factor, yCoord + 5.2 * factor, {
      maxWidth: colStructureW - 8 * factor,
    });
    doc.text("PANEL", colRefX + colRefW / 2, yCoord + 5.2 * factor, {
      align: "center",
      maxWidth: colRefW - 4 * factor,
    });
    doc.text("DESCRIPCIÓN Y CORRELACIÓN 3D", colDescX + 4 * factor, yCoord + 5.2 * factor, {
      maxWidth: colDescW - 8 * factor,
    });

    doc.setDrawColor(203, 213, 225);
    doc.line(colRefX, yCoord, colRefX, yCoord + tableHeaderH);
    doc.line(colDescX, yCoord, colDescX, yCoord + tableHeaderH);
    yCoord += tableHeaderH;

    // Render Rows with calculated heights to prevent any text overflowing
    synopticRows.forEach((row, rIdx) => {
      doc.setFontSize(8 * factor);

      const structLines = doc.splitTextToSize(row.structure || "", colStructureW - 8 * factor);
      const descLines = doc.splitTextToSize(row.findingDetail || "", colDescW - 8 * factor);
      const rowLinesCount = Math.max(descLines.length, structLines.length, 1);
      const rowLineH = 4.4 * factor;
      const rowH = Math.max(9 * factor, rowLinesCount * rowLineH + 6 * factor);

      // Row background
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(marginX, yCoord, contentWidth, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(marginX, yCoord, contentWidth, rowH, "S");
      doc.line(colRefX, yCoord, colRefX, yCoord + rowH);
      doc.line(colDescX, yCoord, colDescX, yCoord + rowH);

      // Structure text
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      let sY = yCoord + 5.2 * factor;
      structLines.forEach((sl: string) => {
        doc.text(sl, colStructureX + 4 * factor, sY);
        sY += rowLineH;
      });

      // Panel Ref Badge (compact: A, B, C...)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(192, 38, 205); // Fuchsia-600 / Magenta
      doc.text(formatPanelRefForPdf(row.panelRef), colRefX + colRefW / 2, yCoord + 5.2 * factor, {
        align: "center",
        maxWidth: colRefW - 4 * factor,
      });

      // Description text
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85); // slate-700
      let dY = yCoord + 5.2 * factor;
      descLines.forEach((dl: string) => {
        doc.text(dl, colDescX + 4 * factor, dY);
        dY += rowLineH;
      });

      yCoord += rowH;
    });

    yCoord += 6 * factor;
  }

  // 5. BIOMECHANICAL & FUNCTIONAL SYNTHESIS BOX
  const synthText = atlasData.biomechanicalSynthesis || atlasData.synthesis;
  if (synthText && synthText.trim()) {
    const bottomMargin = 14 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    const synthLineH = 4.5 * factor;
    const synthLines = doc.splitTextToSize(synthText, contentWidth - 18 * factor);
    const synthBoxH = Math.max(16 * factor, synthLines.length * synthLineH + 13 * factor);

    // Safeguard: if box would touch the bottom margin, adjust yCoord smoothly
    if (yCoord + synthBoxH > pageHeight - bottomMargin) {
      yCoord = pageHeight - bottomMargin - synthBoxH;
    }

    // Warm background box with amber left bar
    doc.setFillColor(254, 252, 232); // Amber-50 / Yellow-50
    doc.setDrawColor(254, 215, 170); // Orange-200
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, yCoord, contentWidth, synthBoxH, 2, 2, "FD");

    // Amber accent bar on left
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(marginX, yCoord, 3.5 * factor, synthBoxH, "F");

    // Stylized vector bullet square for synthesis title (No unicode character)
    doc.setFillColor(217, 119, 6); // Amber-600
    doc.roundedRect(marginX + 7 * factor, yCoord + 4.5 * factor, 3 * factor, 3 * factor, 0.6, 0.6, "F");

    // Title of synthesis
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8 * factor);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text("SÍNTESIS BIOMECÁNICA, FUNCIONAL Y DIAGNÓSTICA:", marginX + 12 * factor, yCoord + 6.8 * factor);

    // Body of synthesis
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    doc.setTextColor(120, 53, 15); // Amber-900
    let curSynthY = yCoord + 12.2 * factor;
    synthLines.forEach((line: string) => {
      doc.text(line, marginX + 7 * factor, curSynthY);
      curSynthY += synthLineH;
    });
  }
}
