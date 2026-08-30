import { Atlas3DData } from "./types";

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
  let yCoord = 20 * factor;

  // 1. TOP HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5 * factor);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ANEXO: ATLAS 3D FOTORREALISTA Y CORRELACIÓN ANATÓMICA", marginX, yCoord);
  yCoord += 4 * factor;

  // Top Accent Line
  doc.setDrawColor(99, 102, 241); // Indigo-500
  doc.setLineWidth(0.6);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 5 * factor;

  // Subtitle / Region metadata
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(100, 116, 139); // slate-500
  const regionLabel = atlasData.studyRegion || "Región Anatómica Evaluada";
  const lateralityLabel = atlasData.detectedLaterality ? ` • Lateralidad: ${atlasData.detectedLaterality}` : "";
  const subtitleText = `Reconstrucción volumétrica tridimensional orientativa correlacionada • Región: ${regionLabel}${lateralityLabel}.`;
  doc.text(subtitleText, marginX, yCoord);
  yCoord += 5 * factor;

  // 2. FIGURE TITLE BANNER (Elegantly styled box with left purple accent)
  const figTitle = atlasData.figureTitle || `FIGURA 1. RECONSTRUCCIÓN ANATÓMICA 3D Y CORRELACIÓN ULTRASONOGRÁFICA DE ${regionLabel.toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 10 * factor);
  const bannerHeight = Math.max(7, figTitleLines.length * 3.8 + 3) * factor;

  // Banner background
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerHeight, 1.5, 1.5, "FD");

  // Left accent bar
  doc.setFillColor(99, 102, 241); // Indigo 500
  doc.rect(marginX, yCoord, 2.5 * factor, bannerHeight, "F");

  // Title Text
  doc.setTextColor(30, 41, 59); // slate-800
  let curTitleY = yCoord + 4.5 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 5 * factor, curTitleY);
    curTitleY += 3.8 * factor;
  });
  yCoord += bannerHeight + 4 * factor;

  // 3. 3D PANELS GRID (2 or 3 Columns)
  const numPanels = validPanels.length;
  const panelGap = 3.5 * factor;
  const panelWidth = (contentWidth - panelGap * (numPanels - 1)) / numPanels;
  
  // Calculate proportional heights (Header + 4:3 Image Container + Caption)
  const cardHeaderH = 6 * factor;
  const imgBoxH = (panelWidth * 0.72); // Maintain ~4:3 aspect ratio
  const captionH = 10 * factor;
  const totalPanelCardH = cardHeaderH + imgBoxH + captionH;

  for (let i = 0; i < numPanels; i++) {
    const panel = validPanels[i];
    const panelX = marginX + i * (panelWidth + panelGap);

    // Card Outer Box
    doc.setFillColor(15, 23, 42); // slate-900
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.3);
    doc.roundedRect(panelX, yCoord, panelWidth, totalPanelCardH, 1.5, 1.5, "FD");

    // Card Header (Violet banner with Panel Letter)
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.roundedRect(panelX, yCoord, panelWidth, cardHeaderH, 1.5, 1.5, "F");
    // Flatten bottom corners of header
    doc.rect(panelX, yCoord + cardHeaderH - 1.5, panelWidth, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7 * factor);
    doc.setTextColor(255, 255, 255);
    const panelHeaderTitle = `PANEL ${panel.panelLetter}: ${panel.panelTitle || ""}`;
    const headerTitleLines = doc.splitTextToSize(panelHeaderTitle, panelWidth - 4 * factor);
    doc.text(headerTitleLines[0] || panelHeaderTitle, panelX + 2.5 * factor, yCoord + 4.2 * factor);

    // Image Placement inside white/clean container
    const imgY = yCoord + cardHeaderH;
    doc.setFillColor(255, 255, 255);
    doc.rect(panelX, imgY, panelWidth, imgBoxH, "F");

    try {
      if (panel.imageUrl) {
        let cleanB64 = panel.imageUrl;
        let format = "JPEG";
        if (cleanB64.startsWith("data:image/png")) format = "PNG";
        if (cleanB64.startsWith("data:image/webp")) format = "WEBP";
        
        // Add image centered inside image container maintaining aspect ratio
        doc.addImage(cleanB64, format, panelX + 0.5 * factor, imgY + 0.5 * factor, panelWidth - 1 * factor, imgBoxH - 1 * factor, undefined, "FAST");
      }
    } catch (imgError) {
      console.warn("Error rendering panel image in PDF:", imgError);
    }

    // Caption Footer (Dark bottom box with Foco: description)
    const captionY = imgY + imgBoxH;
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(panelX, captionY, panelWidth, captionH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    doc.setTextColor(165, 180, 252); // indigo-300
    doc.text("Foco:", panelX + 2 * factor, captionY + 3.8 * factor);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6 * factor);
    doc.setTextColor(226, 232, 240); // slate-200
    const focusText = panel.anatomicalFocus ? panel.anatomicalFocus.replace(/^Foco:\s*/i, "") : "Reconstrucción tridimensional";
    const focusLines = doc.splitTextToSize(focusText, panelWidth - 11 * factor);
    let curLineY = captionY + 3.8 * factor;
    focusLines.slice(0, 2).forEach((l: string) => {
      doc.text(l, panelX + 9 * factor, curLineY);
      curLineY += 3 * factor;
    });
  }

  yCoord += totalPanelCardH + 5 * factor;

  // 4. SYNOPTIC CORRELATION TABLE
  const synopticRows = (atlasData.synopticExplanation || atlasData.synopticTable || []);
  if (synopticRows.length > 0) {
    // Section Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("■ CORRELACIÓN SEMIOLÓGICA DE HALLAZGOS EN RECONSTRUCCIÓN 3D", marginX, yCoord);
    yCoord += 3.5 * factor;

    // Table Column Widths
    const colStructureW = contentWidth * 0.28;
    const colRefW = contentWidth * 0.14;
    const colDescW = contentWidth - colStructureW - colRefW;

    // Table Header Row
    const tableHeaderH = 5 * factor;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.rect(marginX, yCoord, contentWidth, tableHeaderH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text("ESTRUCTURA / FOCO ANATÓMICO", marginX + 2 * factor, yCoord + 3.5 * factor);
    doc.text("REF. PANEL", marginX + colStructureW + 2 * factor, yCoord + 3.5 * factor);
    doc.text("DESCRIPCIÓN PATOLÓGICA Y CORRELACIÓN TRIDIMENSIONAL", marginX + colStructureW + colRefW + 2 * factor, yCoord + 3.5 * factor);
    yCoord += tableHeaderH;

    // Render Rows
    synopticRows.forEach((row, rIdx) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2 * factor);

      const descLines = doc.splitTextToSize(row.findingDetail || "", colDescW - 4 * factor);
      const structLines = doc.splitTextToSize(row.structure || "", colStructureW - 4 * factor);
      const rowLinesCount = Math.max(descLines.length, structLines.length, 1);
      const rowH = Math.max(5.5, rowLinesCount * 3.2 + 2) * factor;

      // Row background
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(marginX, yCoord, contentWidth, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.rect(marginX, yCoord, contentWidth, rowH, "S");

      // Structure text
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      let sY = yCoord + 3.5 * factor;
      structLines.forEach((sl: string) => {
        doc.text(sl, marginX + 2 * factor, sY);
        sY += 3 * factor;
      });

      // Panel Ref Badge
      doc.setFont("helvetica", "bold");
      doc.setTextColor(192, 38, 205); // Fuchsia-600 / Magenta
      doc.text(row.panelRef || "(Panel A)", marginX + colStructureW + 2 * factor, yCoord + 3.5 * factor);

      // Description text
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85); // slate-700
      let dY = yCoord + 3.5 * factor;
      descLines.forEach((dl: string) => {
        doc.text(dl, marginX + colStructureW + colRefW + 2 * factor, dY);
        dY += 3 * factor;
      });

      yCoord += rowH;
    });

    yCoord += 3.5 * factor;
  }

  // 5. BIOMECHANICAL & FUNCTIONAL SYNTHESIS BOX
  const synthText = atlasData.biomechanicalSynthesis || atlasData.synthesis;
  if (synthText && synthText.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    const synthLines = doc.splitTextToSize(synthText, contentWidth - 10 * factor);
    const synthBoxH = Math.max(8, synthLines.length * 3.2 + 6) * factor;

    // Check space limit
    if (yCoord + synthBoxH > pageHeight - 15 * factor) {
      // Scale down gently
      yCoord = pageHeight - synthBoxH - 15 * factor;
    }

    // Warm background box with amber left bar
    doc.setFillColor(254, 252, 232); // Amber-50 / Yellow-50
    doc.setDrawColor(254, 215, 170); // Orange-200
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, yCoord, contentWidth, synthBoxH, 1.2, 1.2, "FD");

    // Amber accent bar on left
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(marginX, yCoord, 2.2 * factor, synthBoxH, "F");

    // Title of synthesis
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text("■ SÍNTESIS BIOMECÁNICA, FUNCIONAL Y DIAGNÓSTICA:", marginX + 5 * factor, yCoord + 4 * factor);

    // Body of synthesis
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2 * factor);
    doc.setTextColor(120, 53, 15); // Amber-900
    let curSynthY = yCoord + 7.5 * factor;
    synthLines.forEach((line: string) => {
      doc.text(line, marginX + 5 * factor, curSynthY);
      curSynthY += 3.2 * factor;
    });
  }
}
