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

  // 2b. PATHOLOGY OVERLAY CALLOUTS (Scorecard sync)
  const overlays = Array.isArray(atlasData.pathologyOverlays) ? atlasData.pathologyOverlays : [];
  if (overlays.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5 * factor);
    doc.setTextColor(190, 24, 93);
    doc.text("PATOLOGIA ACTIVA (OVERLAY ATLAS + SCORECARD)", marginX, yCoord);
    yCoord += 5 * factor;

    overlays.slice(0, 6).forEach((ov, idx) => {
      const line = `${ov.marker || String.fromCharCode(65 + idx)}. [Panel ${ov.panelLetter}] ${ov.structure}: ${ov.finding}${ov.severity ? ` (${ov.severity}/10)` : ""}`;
      const safe = String(line)
        .replace(/≥/g, ">=")
        .replace(/≤/g, "<=");
      const wrapped = doc.splitTextToSize(safe, contentWidth - 4 * factor);
      const blockH = wrapped.length * 3.8 * factor + 2 * factor;
      if (yCoord + blockH > pageHeight - 20 * factor) {
        doc.addPage();
        yCoord = 22 * factor;
      }
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(251, 113, 133);
      doc.roundedRect(marginX, yCoord, contentWidth, blockH + 2 * factor, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(136, 19, 55);
      let ly = yCoord + 4.2 * factor;
      wrapped.forEach((w: string) => {
        doc.text(w, marginX + 3 * factor, ly);
        ly += 3.8 * factor;
      });
      yCoord += blockH + 4 * factor;
    });
    yCoord += 2 * factor;
  }

  // 3. 3D PANELS GRID (1, 2 or 3 columns)
  const numPanels = validPanels.length;
  const isSinglePanel = numPanels === 1;
  const panelGap = (numPanels === 2 ? 6 : 4) * factor;
  let panelWidth = isSinglePanel
    ? contentWidth * 0.56
    : (contentWidth - panelGap * (numPanels - 1)) / numPanels;
  let singlePanelX = isSinglePanel ? marginX + (contentWidth - panelWidth) / 2 : marginX;

  // Calculate proportional heights (Header + 4:3 Image Container + Caption)
  const cardHeaderH = (numPanels === 2 || isSinglePanel ? 8.5 : 7.5) * factor;
  let imgBoxH = panelWidth * 0.75;
  if (isSinglePanel) {
    const maxSingleImgH = 70 * factor;
    if (imgBoxH > maxSingleImgH) {
      imgBoxH = maxSingleImgH;
      panelWidth = imgBoxH / 0.75;
    }
    singlePanelX = marginX + (contentWidth - panelWidth) / 2;
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

  // Bottom margin reserved for running footer
  const bottomMargin = 14 * factor;
  const pageContentBottom = pageHeight - bottomMargin;

  const startContinuationPage = (subtitle: string) => {
    doc.addPage();
    yCoord = 22 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("ANEXO: ATLAS 3D FOTORREALISTA Y CORRELACIÓN ANATÓMICA", marginX, yCoord);
    yCoord += 4 * factor;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.6);
    doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
    yCoord += 5 * factor;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, marginX, yCoord);
    yCoord += 6 * factor;
  };

  // 4. SYNOPTIC CORRELATION TABLE
  // Prefer one page, but if the panel descriptions are extensive, continue on the next
  // page instead of truncating abruptly to fit the final synthesis.
  const synopticRows = (atlasData.synopticExplanation || atlasData.synopticTable || []);
  if (synopticRows.length > 0) {
    const colRefW = 22 * factor;
    const colStructureW = contentWidth * 0.24;
    const colDescW = contentWidth - colStructureW - colRefW;
    const colStructureX = marginX;
    const colRefX = marginX + colStructureW;
    const colDescX = marginX + colStructureW + colRefW;
    const tableHeaderH = 8 * factor;
    const sectionTitleH = 5.5 * factor;

    const formatPanelRefForPdf = (panelRef?: string): string => {
      const raw = (panelRef || "(Panel A)").trim();
      const single = raw.match(/Panel\s+([A-C])/i);
      if (single) return single[1].toUpperCase();
      return raw.replace(/[()]/g, "").replace(/^Panel\s+/i, "P. ");
    };

    const drawSectionTitle = () => {
      doc.setFillColor(99, 102, 241); // Indigo-500
      doc.roundedRect(marginX, yCoord - 3.2 * factor, 3.8 * factor, 3.8 * factor, 0.8, 0.8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("CORRELACIÓN SEMIOLÓGICA DE HALLAZGOS EN RECONSTRUCCIÓN 3D", marginX + 6 * factor, yCoord);
      yCoord += sectionTitleH;
    };

    const drawTableHeader = () => {
      const drawHeaderLabel = (label: string, cellX: number, cellW: number, align: "left" | "center") => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7 * factor);
        doc.setTextColor(51, 65, 85);
        const safeLabel = doc.splitTextToSize(label, cellW - 6 * factor)[0] || label;
        const textWidth = doc.getTextWidth(safeLabel);
        const textX =
          align === "center"
            ? cellX + Math.max(3 * factor, (cellW - textWidth) / 2)
            : cellX + 3 * factor;
        doc.text(safeLabel, textX, yCoord + 5.2 * factor);
      };

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.rect(marginX, yCoord, contentWidth, tableHeaderH, "FD");
      doc.rect(colStructureX, yCoord, colStructureW, tableHeaderH, "S");
      doc.rect(colRefX, yCoord, colRefW, tableHeaderH, "S");
      doc.rect(colDescX, yCoord, colDescW, tableHeaderH, "S");

      drawHeaderLabel("ESTRUCTURA", colStructureX, colStructureW, "left");
      drawHeaderLabel("PANEL", colRefX, colRefW, "center");
      drawHeaderLabel("CORRELACIÓN 3D", colDescX, colDescW, "left");
      yCoord += tableHeaderH;
    };

    // If even the title + header barely fit, start the table on a fresh page
    if (yCoord + sectionTitleH + tableHeaderH + 12 * factor > pageContentBottom) {
      startContinuationPage("Continuación — correlación semiológica de hallazgos");
    }

    drawSectionTitle();
    drawTableHeader();

    synopticRows.forEach((row, rIdx) => {
      doc.setFontSize(8 * factor);

      const structureText = (row.structure || "").replace(/\s*\(Panel[^)]*\)\s*/gi, " ").trim();
      const structLines = doc.splitTextToSize(structureText, colStructureW - 8 * factor);
      const descLines = doc.splitTextToSize(row.findingDetail || "", colDescW - 8 * factor);
      const rowLinesCount = Math.max(descLines.length, structLines.length, 1);
      const rowLineH = 4.4 * factor;
      const rowH = Math.max(9 * factor, rowLinesCount * rowLineH + 6 * factor);

      // Page break before drawing a row that would be cut off
      if (yCoord + rowH > pageContentBottom) {
        startContinuationPage("Continuación — correlación semiológica de hallazgos");
        drawSectionTitle();
        drawTableHeader();
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, yCoord, contentWidth, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, yCoord, contentWidth, rowH, "S");
      doc.line(colRefX, yCoord, colRefX, yCoord + rowH);
      doc.line(colDescX, yCoord, colDescX, yCoord + rowH);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      let sY = yCoord + 5.2 * factor;
      structLines.forEach((sl: string) => {
        doc.text(sl, colStructureX + 4 * factor, sY);
        sY += rowLineH;
      });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(192, 38, 205);
      doc.text(formatPanelRefForPdf(row.panelRef), colRefX + colRefW / 2, yCoord + 5.2 * factor, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
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
  // Never pull this box upward over the table; if it does not fit, continue on next page.
  const synthText = atlasData.biomechanicalSynthesis || atlasData.synthesis;
  if (synthText && synthText.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    const synthLineH = 4.5 * factor;
    const synthLines = doc.splitTextToSize(synthText, contentWidth - 18 * factor);
    const synthBoxH = Math.max(16 * factor, synthLines.length * synthLineH + 13 * factor);

    if (yCoord + synthBoxH > pageContentBottom) {
      startContinuationPage("Continuación — síntesis biomecánica, funcional y diagnóstica");
    }

    // If synthesis itself is longer than one page, paginate its body lines
    const drawSynthChrome = (boxH: number, includeTitle: boolean) => {
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 215, 170);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, yCoord, contentWidth, boxH, 2, 2, "FD");
      doc.setFillColor(245, 158, 11);
      doc.rect(marginX, yCoord, 3.5 * factor, boxH, "F");
      if (includeTitle) {
        doc.setFillColor(217, 119, 6);
        doc.roundedRect(marginX + 7 * factor, yCoord + 4.5 * factor, 3 * factor, 3 * factor, 0.6, 0.6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8 * factor);
        doc.setTextColor(180, 83, 9);
        doc.text("SÍNTESIS BIOMECÁNICA, FUNCIONAL Y DIAGNÓSTICA:", marginX + 12 * factor, yCoord + 6.8 * factor);
      }
    };

    const titleBlockH = 12.2 * factor;
    let lineIdx = 0;
    let firstChunk = true;

    while (lineIdx < synthLines.length) {
      const availableForLines = pageContentBottom - yCoord - (firstChunk ? titleBlockH : 8 * factor) - 4 * factor;
      const maxLinesHere = Math.max(1, Math.floor(availableForLines / synthLineH));
      const chunk = synthLines.slice(lineIdx, lineIdx + maxLinesHere);
      const boxH = Math.max(
        16 * factor,
        (firstChunk ? titleBlockH : 8 * factor) + chunk.length * synthLineH + 4 * factor
      );

      if (yCoord + boxH > pageContentBottom && lineIdx > 0) {
        startContinuationPage("Continuación — síntesis biomecánica, funcional y diagnóstica");
        firstChunk = false;
        continue;
      }

      drawSynthChrome(boxH, firstChunk);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.2 * factor);
      doc.setTextColor(120, 53, 15);
      let curSynthY = yCoord + (firstChunk ? 12.2 * factor : 8 * factor);
      chunk.forEach((line: string) => {
        doc.text(line, marginX + 7 * factor, curSynthY);
        curSynthY += synthLineH;
      });

      lineIdx += chunk.length;
      yCoord += boxH + 4 * factor;
      firstChunk = false;

      if (lineIdx < synthLines.length) {
        startContinuationPage("Continuación — síntesis biomecánica, funcional y diagnóstica");
      }
    }
  }
}
