import jsPDF from "jspdf";
import { Vascular3DData, Vascular3DPanel, VascularHemodynamicRow } from "../types";

/**
 * Renders an exclusive, full-page "ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO"
 * matching the Journal/Atlas Quality visual language of the Atlas 3D annex.
 *
 * Guarantees:
 * 1. Safe top margin starting at y = 22mm (never collides with running header).
 * 2. Exact 4:3 aspect ratio for 3D vascular images (zero distortion).
 * 3. Dark journal-style panel cards identical to Atlas 3D (header + image + Foco caption).
 * 4. Single-panel centering with balanced max height (parity with Atlas).
 * 5. Tailored hemodynamic table corresponding to the vascular territory.
 * 6. Full vertical page utilization with high visual elegance.
 */
export async function renderVascular3DPageToPdf(
  doc: jsPDF,
  vascularData: Vascular3DData,
  pageSize: "letter" | "a4" = "letter",
  pdfLayoutType: string = "modern"
): Promise<void> {
  if (!vascularData || (!vascularData.panels?.length && !vascularData.hemodynamicTable?.length)) {
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2);

  // Scaling factor for A4 vs Letter
  const factor = pageSize === "a4" ? 1.0 : 0.98;

  // Add dedicated exclusive page
  doc.addPage();

  // 1. TOP HEADER (Medical Vascular Style — Atlas parity)
  let yCoord = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO", marginX, yCoord);
  yCoord += 4.5 * factor;

  // Accent Line (Indigo — same as Atlas)
  doc.setDrawColor(99, 102, 241); // Indigo-500
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 7 * factor;

  // 2. FIGURE TITLE BANNER (Atlas-style elegant box with left accent)
  const territory = vascularData.territoryLabel || "DOPPLER VASCULAR";
  const figTitle = vascularData.figureTitle || `FIGURA 1. RECONSTRUCCIÓN VASCULAR 3D Y CORRELACIÓN HEMODINÁMICA DE ${territory.toUpperCase()}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  const figTitleLines = doc.splitTextToSize(figTitle, contentWidth - 18 * factor);
  const figLineH = 4.8 * factor;
  const bannerHeight = Math.max(10 * factor, figTitleLines.length * figLineH + 6 * factor);

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, yCoord, contentWidth, bannerHeight, 2, 2, "FD");

  // Left accent bar
  doc.setFillColor(99, 102, 241); // Indigo-500
  doc.rect(marginX, yCoord, 3.5 * factor, bannerHeight, "F");

  doc.setTextColor(30, 41, 59); // slate-800
  let curTitleY = yCoord + 5.5 * factor;
  figTitleLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, curTitleY);
    curTitleY += figLineH;
  });
  yCoord += bannerHeight + 6 * factor;

  // 3. 3D VASCULAR PANELS — Atlas Journal Quality dark cards
  const validPanels: Vascular3DPanel[] = (vascularData.panels || []).filter(
    (p) => p && (p.imageUrl || p.panelTitle)
  );
  const numPanels = Math.min(Math.max(validPanels.length, 0), 3);

  if (numPanels > 0) {
    const isSinglePanel = numPanels === 1;
    const panelGap = (numPanels === 2 ? 6 : 4) * factor;
    let panelWidth = isSinglePanel
      ? contentWidth * 0.56
      : (contentWidth - panelGap * (numPanels - 1)) / numPanels;
    let singlePanelX = isSinglePanel ? marginX + (contentWidth - panelWidth) / 2 : marginX;

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

    // Pre-calculate captions for exact height fitting (Atlas pattern)
    doc.setFont("helvetica", "normal");
    const captionFontSize = (numPanels === 2 || isSinglePanel ? 8 : 7.2) * factor;
    doc.setFontSize(captionFontSize);
    const captionLineH = (numPanels === 2 || isSinglePanel ? 4.2 : 3.8) * factor;

    const panelCalculatedData = validPanels.slice(0, numPanels).map((panel) => {
      const focusText = panel.anatomicalFocus
        ? panel.anatomicalFocus.replace(/^Foco:\s*/i, "")
        : "Reconstrucción vascular tridimensional";
      const focusAvailableWidth = panelWidth - (numPanels === 2 || isSinglePanel ? 18 : 14) * factor;
      const focusLines = doc.splitTextToSize(focusText, focusAvailableWidth);
      return {
        focusText,
        focusLines,
        lineCount: Math.max(focusLines.length, 1)
      };
    });

    const maxCaptionLines = Math.max(...panelCalculatedData.map((p) => p.lineCount), 2);
    const captionH = Math.max(14 * factor, maxCaptionLines * captionLineH + 8 * factor);
    const totalPanelCardH = cardHeaderH + imgBoxH + captionH;

    for (let i = 0; i < numPanels; i++) {
      const panel = validPanels[i];
      const calcData = panelCalculatedData[i];
      const panelX = isSinglePanel ? singlePanelX : marginX + i * (panelWidth + panelGap);

      // Card Outer Box (dark journal style)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.setDrawColor(51, 65, 85); // slate-700
      doc.setLineWidth(0.4);
      doc.roundedRect(panelX, yCoord, panelWidth, totalPanelCardH, 2.5, 2.5, "FD");

      // Card Header (Indigo banner with Panel Letter)
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.roundedRect(panelX, yCoord, panelWidth, cardHeaderH, 2.5, 2.5, "F");
      doc.rect(panelX, yCoord + cardHeaderH - 2.5, panelWidth, 2.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize((numPanels === 2 || isSinglePanel ? 8.5 : 7.5) * factor);
      doc.setTextColor(255, 255, 255);
      const panelHeaderTitle = `PANEL ${panel.panelLetter}: ${panel.panelTitle || ""}`;
      const headerTitleLines = doc.splitTextToSize(panelHeaderTitle, panelWidth - 6 * factor);
      doc.text(headerTitleLines[0] || panelHeaderTitle, panelX + 3.5 * factor, yCoord + 5.5 * factor);

      // Image Placement — exact 4:3
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
        console.warn("Error rendering vascular panel image in PDF:", imgError);
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
        const textX = lIdx === 0 ? focoLabelX + focoLabelWidth : focoLabelX;
        doc.text(l, textX, curLineY);
        curLineY += captionLineH;
      });
    }

    yCoord += totalPanelCardH + 7 * factor;
  }

  // 4. TAILORED HEMODYNAMIC TABLE
  const tableData: VascularHemodynamicRow[] = vascularData.hemodynamicTable || [];
  const tableTitle = vascularData.tableTitle || `TABLA HEMODINÁMICA Y CARACTERIZACIÓN DE LESIONES:`;
  const headers = vascularData.tableHeaders || {
    col1: "VASO / SEGMENTO",
    col2: "PLACA / TROMBO",
    col3: "% ESTENOSIS",
    col4: "PATRÓN (PSV/EDV)",
    col5: "REL. / ÍNDICE",
    col6: "IMPACTO HEMODIN."
  };

  if (tableData.length > 0) {
    // Section Header with stylized vector square (Atlas pattern)
    doc.setFillColor(99, 102, 241); // Indigo-500
    doc.roundedRect(marginX, yCoord - 3.2 * factor, 3.8 * factor, 3.8 * factor, 0.8, 0.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text(tableTitle.toUpperCase(), marginX + 6 * factor, yCoord);
    yCoord += 5.5 * factor;

    const colWidths = [
      contentWidth * 0.23,
      contentWidth * 0.23,
      contentWidth * 0.13,
      contentWidth * 0.15,
      contentWidth * 0.13,
      contentWidth * 0.13
    ];

    const headerLabels = [
      headers.col1 || "VASO / SEGMENTO",
      headers.col2 || "PLACA / TROMBO",
      headers.col3 || "% ESTENOSIS",
      headers.col4 || "PATRÓN (PSV/EDV)",
      headers.col5 || "REL. / ÍNDICE",
      headers.col6 || "IMPACTO HEMODIN."
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    doc.setTextColor(51, 65, 85);

    const wrappedHeaders = headerLabels.map((lbl, i) => {
      return doc.splitTextToSize(lbl.toUpperCase(), colWidths[i] - 3.5);
    });

    const maxHeaderLines = Math.max(...wrappedHeaders.map((lines) => lines.length), 1);
    const headerH = Math.max(6.5 * factor, (maxHeaderLines * 2.8 + 2.5) * factor);

    // Isolated header cells (Atlas clash-safe pattern)
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.rect(marginX, yCoord, contentWidth, headerH, "FD");

    let curX = marginX;
    wrappedHeaders.forEach((lines, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2 * factor);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, curX + 2, yCoord + 3.2 * factor);
      doc.setDrawColor(203, 213, 225);
      doc.rect(curX, yCoord, colWidths[i], headerH, "S");
      curX += colWidths[i];
    });
    yCoord += headerH;

    const visibleRows = tableData.slice(0, 9);

    visibleRows.forEach((row, rIdx) => {
      // Page-break safeguard for long tables
      const estimatedRowH = 8 * factor;
      if (yCoord + estimatedRowH > pageHeight - 28 * factor) {
        doc.addPage();
        yCoord = 22 * factor;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5 * factor);

      const c1Lines = doc.splitTextToSize(row.vessel || "", colWidths[0] - 3);
      const c2Lines = doc.splitTextToSize(row.plaqueOrThrombus || "", colWidths[1] - 3);
      const c3Lines = doc.splitTextToSize(row.stenosisPercent || "0%", colWidths[2] - 3);
      const c4Lines = doc.splitTextToSize(row.patternOrVelocity || "", colWidths[3] - 3);
      const c5Lines = doc.splitTextToSize(row.hemodynamicIndex || "N/A", colWidths[4] - 3);
      const c6Lines = doc.splitTextToSize(row.clinicalImpact || "", colWidths[5] - 3);

      const maxLines = Math.max(
        c1Lines.length,
        c2Lines.length,
        c3Lines.length,
        c4Lines.length,
        c5Lines.length,
        c6Lines.length,
        1
      );
      const rowH = Math.max(5.2 * factor, (maxLines * 3.0 + 2.2) * factor);

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, yCoord, contentWidth, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, yCoord, contentWidth, rowH, "S");

      let cellX = marginX;
      let dividerX = marginX;
      for (let ci = 0; ci < colWidths.length - 1; ci++) {
        dividerX += colWidths[ci];
        doc.line(dividerX, yCoord, dividerX, yCoord + rowH);
      }

      // Col 1
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text(c1Lines, cellX + 2, yCoord + 3.0 * factor);
      cellX += colWidths[0];

      // Col 2
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3 * factor);
      doc.setTextColor(71, 85, 105);
      doc.text(c2Lines, cellX + 2, yCoord + 3.0 * factor);
      cellX += colWidths[1];

      // Col 3 — color-coded severity
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5 * factor);
      const stText = (row.stenosisPercent || "").trim().toLowerCase();
      if (
        stText.includes(">") ||
        stText.includes("70") ||
        stText.includes("80") ||
        stText.includes("90") ||
        stText.includes("100") ||
        stText.includes("oclus") ||
        stText.includes("ausente") ||
        stText.includes("tromb") ||
        stText.includes("sever")
      ) {
        doc.setTextColor(220, 38, 38);
      } else if (
        stText.includes("50") ||
        stText.includes("60") ||
        stText.includes("< 50") ||
        stText.includes("moderad") ||
        stText.includes("parcial")
      ) {
        doc.setTextColor(217, 119, 6);
      } else {
        doc.setTextColor(22, 101, 52);
      }
      doc.text(c3Lines, cellX + 2, yCoord + 3.0 * factor);
      cellX += colWidths[2];

      // Col 4
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3 * factor);
      doc.setTextColor(51, 65, 85);
      doc.text(c4Lines, cellX + 2, yCoord + 3.0 * factor);
      cellX += colWidths[3];

      // Col 5
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4 * factor);
      const refText = (row.hemodynamicIndex || "").toLowerCase();
      if (
        refText.includes("reflujo") ||
        refText.includes("incompet") ||
        refText.includes("patol") ||
        refText.includes("oclus")
      ) {
        doc.setTextColor(220, 38, 38);
      } else {
        doc.setTextColor(14, 116, 144);
      }
      doc.text(c5Lines, cellX + 2, yCoord + 3.0 * factor);
      cellX += colWidths[4];

      // Col 6
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3 * factor);
      doc.setTextColor(71, 85, 105);
      doc.text(c6Lines, cellX + 2, yCoord + 3.0 * factor);

      yCoord += rowH;
    });

    yCoord += 6 * factor;
  }

  // 5. MORPHOLOGICAL & HEMODYNAMIC SYNTHESIS BOX (Atlas amber-style warmth → rose for vascular)
  const synthText = vascularData.morphologicalSynthesis || "";
  if (synthText && synthText.trim()) {
    const bottomMargin = 14 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    const synthLineH = 4.5 * factor;
    const synthLines = doc.splitTextToSize(synthText.trim(), contentWidth - 18 * factor);
    const synthBoxH = Math.max(16 * factor, synthLines.length * synthLineH + 13 * factor);

    if (yCoord + synthBoxH > pageHeight - bottomMargin) {
      // Soft fit: new page if needed rather than crushing text
      if (synthBoxH < pageHeight - bottomMargin - 22 * factor) {
        doc.addPage();
        yCoord = 22 * factor;
      } else {
        yCoord = pageHeight - bottomMargin - synthBoxH;
      }
    }

    doc.setFillColor(254, 242, 242); // rose-50
    doc.setDrawColor(254, 202, 202); // rose-200
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, yCoord, contentWidth, synthBoxH, 2, 2, "FD");

    doc.setFillColor(225, 29, 72); // Rose-600
    doc.rect(marginX, yCoord, 3.5 * factor, synthBoxH, "F");

    doc.setFillColor(190, 18, 60); // Rose-700
    doc.roundedRect(marginX + 7 * factor, yCoord + 4.5 * factor, 3 * factor, 3 * factor, 0.6, 0.6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8 * factor);
    doc.setTextColor(190, 18, 60);
    doc.text(
      vascularData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:",
      marginX + 12 * factor,
      yCoord + 6.8 * factor
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2 * factor);
    doc.setTextColor(136, 19, 55); // rose-900
    let curSynthY = yCoord + 12.2 * factor;
    synthLines.forEach((line: string) => {
      doc.text(line, marginX + 7 * factor, curSynthY);
      curSynthY += synthLineH;
    });
  }
}
