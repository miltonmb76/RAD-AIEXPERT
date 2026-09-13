import jsPDF from "jspdf";
import { Breast3DData, Breast3DPanel, BreastLesionRow } from "../types";

/**
 * Renders an exclusive, full-page "ANEXO: SUITE MAMA 3D & FICHA BI-RADS Y CORRELACIÓN 3D" into the provided jsPDF document.
 * 
 * Guarantees:
 * 1. Safe top margin starting at y = 22mm (never collides with running header).
 * 2. Exact 4:3 aspect ratio for 3D vascular images (zero distortion).
 * 3. Intelligent dynamic height allocation so no text overflows borders.
 * 4. Tailored hemodynamic table corresponding to the vascular territory.
 * 5. Full vertical page utilization with high visual elegance.
 */
export async function renderBreast3DPageToPdf(
  doc: jsPDF,
  breastData: Breast3DData,
  pageSize: "letter" | "a4" = "letter",
  pdfLayoutType: string = "modern"
): Promise<void> {
  if (!breastData || (!breastData.panels?.length && !breastData.lesionTable?.length)) {
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

  // 1. TOP HEADER (Medical Vascular Style)
  let yCoord = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ANEXO: SUITE MAMA 3D & FICHA BI-RADS Y CORRELACIÓN 3D", marginX, yCoord);
  yCoord += 4.5 * factor;

  // Accent Line (Royal Teal / Vascular Purple-Blue)
  doc.setDrawColor(219, 39, 119); // Teal-600
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 6.5 * factor;

  // 2. FIGURE TITLE BANNER
  const territory = breastData.territoryLabel || "DOPPLER VASCULAR";
  const figTitle = breastData.figureTitle || `FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA DE ${territory.toUpperCase()}`;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  doc.setTextColor(30, 41, 59); // slate-800
  const figTitleLines = doc.splitTextToSize(figTitle.toUpperCase(), contentWidth - 10);
  const figBannerH = Math.max(7.5 * factor, (figTitleLines.length * 4.2 + 3) * factor);

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, yCoord, contentWidth, figBannerH, 1.5, 1.5, "FD");

  // Left accent bar
  doc.setFillColor(219, 39, 119);
  doc.rect(marginX, yCoord, 2.5, figBannerH, "F");

  doc.text(figTitleLines, marginX + 5, yCoord + (figBannerH / 2) + 1.2);
  yCoord += figBannerH + 4 * factor;


  // 3. 3D VASCULAR PANELS (2 or 3 Panels with strict 4:3 Aspect Ratio)
  const panels: Breast3DPanel[] = (breastData.panels || []).filter(p => p && (p.imageUrl || p.panelTitle));
  const panelCount = Math.min(Math.max(panels.length, 1), 3);

  if (panelCount > 0) {
    const gap = panelCount === 3 ? 3.5 : 5;
    const totalGaps = (panelCount - 1) * gap;
    const cardWidth = (contentWidth - totalGaps) / panelCount;
    const imgWidth = cardWidth - 4;
    const imgHeight = imgWidth * (3 / 4); // Strict 4:3 ratio

    // Caption box hugs text tightly (no large empty footer) so the hemodynamic table keeps readable type
    const measureCaptionH = (p: Breast3DPanel): number => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      let h = 3.2 * factor; // gap under image
      h += titleLines.length * 3.4 * factor;
      if (p.anatomicalFocus && String(p.anatomicalFocus).trim()) {
        h += 1.0 * factor; // gap title → description
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2 * factor);
        const descLines = doc.splitTextToSize(String(p.anatomicalFocus).trim(), cardWidth - 6);
        h += descLines.length * 3.05 * factor;
      }
      h += 2.2 * factor; // bottom padding inside card border
      return h;
    };
    const captionAreaH = Math.max(
      ...panels.slice(0, panelCount).map(measureCaptionH),
      7 * factor
    );
    const cardH = imgHeight + captionAreaH + 4;

    for (let idx = 0; idx < panelCount; idx++) {
      const p = panels[idx] || {
        panelLetter: String.fromCharCode(65 + idx),
        panelTitle: `Panel ${String.fromCharCode(65 + idx)}`,
        anatomicalFocus: "",
        imageUrl: ""
      } as Breast3DPanel;
      const cardX = marginX + idx * (cardWidth + gap);

      // Card Background with soft border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.roundedRect(cardX, yCoord, cardWidth, cardH, 2, 2, "FD");

      // Image Render
      const imgX = cardX + 2;
      const imgY = yCoord + 2;

      if (p.imageUrl && p.imageUrl.startsWith("data:image")) {
        try {
          const imgFormat = p.imageUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(p.imageUrl, imgFormat, imgX, imgY, imgWidth, imgHeight);
        } catch (imgErr) {
          console.warn("Error drawing vascular 3D image to PDF:", imgErr);
          doc.setFillColor(241, 245, 249);
          doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
        }
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8 * factor);
        doc.setTextColor(148, 163, 184);
        doc.text("Reconstrucción 3D Tiroidea", imgX + (imgWidth / 2) - 18, imgY + (imgHeight / 2));
      }

      // Panel Badge (e.g. PANEL A, PANEL B)
      const badgeW = 20 * factor;
      const badgeH = 5 * factor;
      doc.setFillColor(219, 39, 119); // Teal-600
      doc.roundedRect(imgX + 2, imgY + 2, badgeW, badgeH, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(255, 255, 255);
      doc.text(`PANEL ${p.panelLetter || String.fromCharCode(65 + idx)}`, imgX + 3.5, imgY + 2 + 3.6);

      // Panel Title — metrics must match measureCaptionH()
      let textY = imgY + imgHeight + 3.2 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      doc.text(titleLines, cardX + 3, textY);
      textY += titleLines.length * 3.4 * factor;

      // Anatomical Focus / Description
      if (p.anatomicalFocus && String(p.anatomicalFocus).trim()) {
        textY += 1.0 * factor;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2 * factor);
        doc.setTextColor(71, 85, 105); // slate-600
        const descLines = doc.splitTextToSize(String(p.anatomicalFocus).trim(), cardWidth - 6);
        doc.text(descLines, cardX + 3, textY);
      }
    }

    yCoord += cardH + 5 * factor;
  }

  // 2b. RICH CLINICAL DOSSIER (fills page with substantial info under the figure concept)
  const dossierBlocks: Array<{ title: string; text: string; color: [number, number, number] }> = [
    { title: "RESUMEN MAMARIO", text: String(breastData.breastSummary || "").trim(), color: [219, 39, 119] },
    { title: "MORFOLOGÍA / NÓDULO DOMINANTE", text: String(breastData.morphologyNotes || "").trim(), color: [192, 38, 211] },
    { title: "AXILAS / DRENAJE", text: String(breastData.axillaryStatus || "").trim(), color: [217, 119, 6] },
  ];
  const keyPoints = Array.isArray(breastData.keyPoints) ? breastData.keyPoints.filter(Boolean) : [];
  if (keyPoints.length) {
    dossierBlocks.push({
      title: "PUNTOS CLAVE",
      text: keyPoints.map((k) => `• ${k}`).join("\n"),
      color: [5, 150, 105],
    });
  }

  const dossierTexts = dossierBlocks.filter((b) => b.text);
  if (dossierTexts.length) {
    const availableBeforePanels = Math.max(28 * factor, 36 * factor);
    let dossierY = yCoord;
    const colGap = 3.5;
    const cols = dossierTexts.length >= 3 ? 2 : 1;
    const boxW = cols === 2 ? (contentWidth - colGap) / 2 : contentWidth;
    let col = 0;
    let rowY = dossierY;
    let maxRowH = 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text("FICHA CLÍNICA MAMARIA (CORRELACIÓN CON LA FIGURA 3D)", marginX, dossierY);
    dossierY += 3.2 * factor;
    rowY = dossierY;

    for (let i = 0; i < dossierTexts.length; i++) {
      const b = dossierTexts[i];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2 * factor);
      const titleH = 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.0 * factor);
      const lines = doc.splitTextToSize(b.text, boxW - 6);
      const maxLines = cols === 2 ? 5 : 4;
      const used = lines.slice(0, maxLines);
      const textH = used.length * 3.05 * factor;
      const boxH = titleH + textH + 4 * factor;
      const x = marginX + col * (boxW + colGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, rowY, boxW, boxH, 1.2, 1.2, "FD");
      doc.setFillColor(b.color[0], b.color[1], b.color[2]);
      doc.rect(x, rowY, 2.0, boxH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.0 * factor);
      doc.setTextColor(b.color[0], b.color[1], b.color[2]);
      doc.text(b.title, x + 4, rowY + 3.6 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(51, 65, 85);
      doc.text(used, x + 4, rowY + titleH + 2.2 * factor);
      maxRowH = Math.max(maxRowH, boxH);
      col += 1;
      if (col >= cols) {
        col = 0;
        rowY += maxRowH + 2.5 * factor;
        maxRowH = 0;
      }
    }
    if (col !== 0) rowY += maxRowH + 2.5 * factor;
    yCoord = rowY + 1.5 * factor;
  }


  
// 4. BI-RADS LESION TABLE (fixed headers — never trust model col order for PDF)
  const tableData: BreastLesionRow[] = breastData.lesionTable || [];
  const tableTitle = breastData.tableTitle || `TABLA ECOGRÁFICA Y CARACTERIZACIÓN DE LESIONES MAMARIAS:`;

  // Section Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(tableTitle.toUpperCase(), marginX, yCoord);
  yCoord += 3.5 * factor;

  // Fixed 6-col layout matching UI semantics: composition BEFORE size
  // Wider COMPOSICIÓN so the accented header does not wrap as "COMPOSICI / ÓN"
  const colWidths = [
    contentWidth * 0.20,
    contentWidth * 0.16,
    contentWidth * 0.12,
    contentWidth * 0.18,
    contentWidth * 0.14,
    contentWidth * 0.20
  ];

  const headerLabels = [
    "LOCALIZACIÓN",
    "COMPOSICIÓN",
    "TAMAÑO",
    "ECOGENICIDAD",
    "MÁRGENES",
    "BI-RADS / IMPACTO"
  ];

  // Calculate dynamic header height with automatic text wrapping
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(51, 65, 85); // slate-700

  const wrappedHeaders = headerLabels.map((lbl, i) => {
    return doc.splitTextToSize(lbl, colWidths[i] - 3.5);
  });

  const maxHeaderLines = Math.max(...wrappedHeaders.map(lines => lines.length), 1);
  const headerH = Math.max(7.2 * factor, (maxHeaderLines * 3.1 + 2.8) * factor);

  // Table Header Background
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(marginX, yCoord, contentWidth, headerH, "F");

  // Render wrapped headers
  let curX = marginX;
  wrappedHeaders.forEach((lines, i) => {
    doc.text(lines, curX + 2, yCoord + 3.2 * factor);
    curX += colWidths[i];
  });

  // Header bottom border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, yCoord + headerH, marginX + contentWidth, yCoord + headerH);
  yCoord += headerH;

  // Table Rows with dynamic wrapping
  const visibleRows = tableData.slice(0, 9); // limit to fit comfortably on one page
  
  visibleRows.forEach((row, rIdx) => {
    // Split texts to calculate row height
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4 * factor);

    const compositionText = (row.composition || row.shape || "—").trim() || "—";
    const sizeText = (row.size || "—").trim() || "—";
    const echoText = [row.echogenicity, row.orientation, row.vascularity].filter(Boolean).join(" · ") || "—";
    const marginsText = (row.margins || "—").trim() || "—";
    const impactText = row.biradsCategory
      ? `${row.biradsCategory}${row.clinicalImpact ? ` — ${row.clinicalImpact}` : ""}`
      : (row.clinicalImpact || "—");

    const c1Lines = doc.splitTextToSize(row.location || "", colWidths[0] - 3);
    const c2Lines = doc.splitTextToSize(compositionText, colWidths[1] - 3);
    const c3Lines = doc.splitTextToSize(sizeText, colWidths[2] - 3);
    const c4Lines = doc.splitTextToSize(echoText, colWidths[3] - 3);
    const c5Lines = doc.splitTextToSize(marginsText, colWidths[4] - 3);
    const c6Lines = doc.splitTextToSize(impactText, colWidths[5] - 3);

    const maxLines = Math.max(c1Lines.length, c2Lines.length, c3Lines.length, c4Lines.length, c5Lines.length, c6Lines.length, 1);
    const rowH = Math.max(5.8 * factor, (maxLines * 3.3 + 2.4) * factor);

    // Zebra striping
    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, yCoord, contentWidth, rowH, "F");
    }

    let cellX = marginX;

    // Col 1: Localización
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text(c1Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[0];

    // Col 2: Composición
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(22, 101, 52); // green — morphology cue
    doc.text(c2Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[1];

    // Col 3: Tamaño
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(c3Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[2];

    // Col 4: Ecogenicidad (+ orient. / vasc.)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(c4Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[3];

    // Col 5: Márgenes
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(71, 85, 105);
    doc.text(c5Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[4];

    // Col 6: BI-RADS / Impacto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(37, 99, 235); // blue for category + impact
    doc.text(c6Lines, cellX + 2, yCoord + 3.0 * factor);

    // Row bottom separator line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(marginX, yCoord + rowH, marginX + contentWidth, yCoord + rowH);

    yCoord += rowH;
  });

  // Table bottom border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, yCoord, marginX + contentWidth, yCoord);
  yCoord += 4.5 * factor;

  // 5. MORPHOLOGICAL & HEMODYNAMIC SYNTHESIS BOX
  // Keep clear of the gray running footer (~10mm from page bottom). Never overflow text past the box.
  const synthText = breastData.morphologicalSynthesis || "";
  if (synthText && synthText.trim()) {
    const footerSafeBottom = pageHeight - 18 * factor;
    const synthTitle = breastData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6 * factor);
    const synthLineH = 3.8 * factor;
    const synthLines = doc.splitTextToSize(synthText.trim(), contentWidth - 12);
    const titleBlockH = 9.5 * factor;
    const bottomPad = 3.5 * factor;

    const startSynthContinuationPage = () => {
      doc.addPage();
      yCoord = 22 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("ANEXO: SUITE MAMA 3D & FICHA BI-RADS Y CORRELACIÓN 3D", marginX, yCoord);
      yCoord += 4 * factor;
      doc.setDrawColor(219, 39, 119);
      doc.setLineWidth(0.6);
      doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
      yCoord += 5 * factor;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8 * factor);
      doc.setTextColor(100, 116, 139);
      doc.text("Continuación — síntesis morfológica y hemodinámica", marginX, yCoord);
      yCoord += 6 * factor;
    };

    const drawSynthChrome = (boxH: number, includeTitle: boolean) => {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, yCoord, contentWidth, boxH, 2, 2, "FD");
      doc.setFillColor(225, 29, 72); // Rose-600
      doc.rect(marginX, yCoord, 2.5, boxH, "F");
      if (includeTitle) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5 * factor);
        doc.setTextColor(190, 18, 60); // Rose-700
        doc.text(synthTitle, marginX + 6, yCoord + 5.5 * factor);
      }
    };

    let lineIdx = 0;
    let firstChunk = true;

    // If almost no room left on this page, move synthesis to a clean continuation page
    if (footerSafeBottom - yCoord < 18 * factor) {
      startSynthContinuationPage();
      firstChunk = true;
    }

    while (lineIdx < synthLines.length) {
      const headerH = firstChunk ? titleBlockH : 6.5 * factor;
      const availableForLines = footerSafeBottom - yCoord - headerH - bottomPad;
      let maxLinesHere = Math.floor(availableForLines / synthLineH);

      if (maxLinesHere < 1) {
        startSynthContinuationPage();
        firstChunk = false;
        continue;
      }

      const chunk = synthLines.slice(lineIdx, lineIdx + maxLinesHere);
      const boxH = headerH + chunk.length * synthLineH + bottomPad;

      drawSynthChrome(boxH, firstChunk);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6 * factor);
      doc.setTextColor(51, 65, 85); // slate-700
      let curY = yCoord + headerH;
      chunk.forEach((line: string) => {
        doc.text(line, marginX + 6, curY);
        curY += synthLineH;
      });

      lineIdx += chunk.length;
      yCoord += boxH + 3 * factor;
      firstChunk = false;

      if (lineIdx < synthLines.length) {
        startSynthContinuationPage();
      }
    }
  }
}
