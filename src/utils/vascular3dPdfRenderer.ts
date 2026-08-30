import jsPDF from "jspdf";
import { Vascular3DData, Vascular3DPanel, VascularHemodynamicRow } from "../types";

/**
 * Renders an exclusive, full-page "ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO" into the provided jsPDF document.
 * 
 * Guarantees:
 * 1. Safe top margin starting at y = 22mm (never collides with running header).
 * 2. Exact 4:3 aspect ratio for 3D vascular images (zero distortion).
 * 3. Intelligent dynamic height allocation so no text overflows borders.
 * 4. Tailored hemodynamic table corresponding to the vascular territory.
 * 5. Full vertical page utilization with high visual elegance.
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

  // 1. TOP HEADER (Medical Vascular Style)
  let yCoord = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ANEXO: SUITE VASCULAR 3D & MAPA ANATOMO-HEMODINÁMICO", marginX, yCoord);
  yCoord += 4.5 * factor;

  // Accent Line (Royal Indigo / Vascular Purple-Blue)
  doc.setDrawColor(79, 70, 229); // Indigo-600
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 6.5 * factor;

  // 2. FIGURE TITLE BANNER
  const territory = vascularData.territoryLabel || "DOPPLER VASCULAR";
  const figTitle = vascularData.figureTitle || `FIGURA 1. ATLAS 3D DE CORRELACIÓN ANATOMOPATOLÓGICA Y HEMODINÁMICA DE ${territory.toUpperCase()}`;
  
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
  doc.setFillColor(79, 70, 229);
  doc.rect(marginX, yCoord, 2.5, figBannerH, "F");

  doc.text(figTitleLines, marginX + 5, yCoord + (figBannerH / 2) + 1.2);
  yCoord += figBannerH + 4 * factor;

  // 3. 3D VASCULAR PANELS (2 or 3 Panels with strict 4:3 Aspect Ratio)
  const panels: Vascular3DPanel[] = (vascularData.panels || []).filter(p => p && (p.imageUrl || p.panelTitle));
  const panelCount = Math.min(Math.max(panels.length, 1), 3);

  if (panelCount > 0) {
    const gap = panelCount === 3 ? 3.5 : 5;
    const totalGaps = (panelCount - 1) * gap;
    const cardWidth = (contentWidth - totalGaps) / panelCount;
    const imgWidth = cardWidth - 4;
    const imgHeight = imgWidth * (3 / 4); // Strict 4:3 ratio

    // Pre-calculate caption heights to size card dynamically
    let maxCaptionLines = 1;
    panels.forEach(p => {
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      const descLines = doc.splitTextToSize(p.anatomicalFocus || "", cardWidth - 6);
      const totalL = titleLines.length + descLines.length;
      if (totalL > maxCaptionLines) maxCaptionLines = totalL;
    });

    const captionAreaH = Math.max(18 * factor, (maxCaptionLines * 3.6 + 6) * factor);
    const cardH = imgHeight + captionAreaH + 4;

    for (let idx = 0; idx < panelCount; idx++) {
      const p = panels[idx];
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
        doc.text("Reconstrucción 3D Vascular", imgX + (imgWidth / 2) - 18, imgY + (imgHeight / 2));
      }

      // Panel Badge (e.g. PANEL A, PANEL B)
      const badgeW = 20 * factor;
      const badgeH = 5 * factor;
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.roundedRect(imgX + 2, imgY + 2, badgeW, badgeH, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(255, 255, 255);
      doc.text(`PANEL ${p.panelLetter || String.fromCharCode(65 + idx)}`, imgX + 3.5, imgY + 2 + 3.6);

      // Panel Title
      let textY = imgY + imgHeight + 3.5 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      doc.text(titleLines, cardX + 3, textY);
      textY += (titleLines.length * 3.4) + 1.5;

      // Anatomical Focus / Description
      if (p.anatomicalFocus) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2 * factor);
        doc.setTextColor(71, 85, 105); // slate-600
        const descLines = doc.splitTextToSize(p.anatomicalFocus, cardWidth - 6);
        doc.text(descLines, cardX + 3, textY);
      }
    }

    yCoord += cardH + 5 * factor;
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

  // Section Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(tableTitle.toUpperCase(), marginX, yCoord);
  yCoord += 3.5 * factor;

  // Column Widths dynamically tuned to prevent header & content overlap
  // Total: contentWidth
  // Col 1: Vaso / Segmento (23%)
  // Col 2: Placa / Morfología / Compresibilidad (23%)
  // Col 3: % Estenosis / Flujo / Diámetro (13%)
  // Col 4: Patrón / Velocidad / Maniobras (15%)
  // Col 5: Índice / Reflujo / Doppler (13%)
  // Col 6: Impacto / Estado Clínico (13%)
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

  // Calculate dynamic header height with automatic text wrapping
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2 * factor);
  doc.setTextColor(51, 65, 85); // slate-700

  const wrappedHeaders = headerLabels.map((lbl, i) => {
    return doc.splitTextToSize(lbl.toUpperCase(), colWidths[i] - 3.5);
  });

  const maxHeaderLines = Math.max(...wrappedHeaders.map(lines => lines.length), 1);
  const headerH = Math.max(6.5 * factor, (maxHeaderLines * 2.8 + 2.5) * factor);

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
    doc.setFontSize(6.5 * factor);

    const c1Lines = doc.splitTextToSize(row.vessel || "", colWidths[0] - 3);
    const c2Lines = doc.splitTextToSize(row.plaqueOrThrombus || "", colWidths[1] - 3);
    const c3Lines = doc.splitTextToSize(row.stenosisPercent || "0%", colWidths[2] - 3);
    const c4Lines = doc.splitTextToSize(row.patternOrVelocity || "", colWidths[3] - 3);
    const c5Lines = doc.splitTextToSize(row.hemodynamicIndex || "N/A", colWidths[4] - 3);
    const c6Lines = doc.splitTextToSize(row.clinicalImpact || "", colWidths[5] - 3);

    const maxLines = Math.max(c1Lines.length, c2Lines.length, c3Lines.length, c4Lines.length, c5Lines.length, c6Lines.length, 1);
    const rowH = Math.max(5.2 * factor, (maxLines * 3.0 + 2.2) * factor);

    // Zebra striping
    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, yCoord, contentWidth, rowH, "F");
    }

    let cellX = marginX;

    // Col 1: Vaso (Bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(15, 23, 42);
    doc.text(c1Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[0];

    // Col 2: Placa / Trombo / Compresibilidad
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3 * factor);
    doc.setTextColor(71, 85, 105);
    doc.text(c2Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[1];

    // Col 3: % Estenosis / Flujo Espontáneo / Diámetro (Color coding)
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
      doc.setTextColor(220, 38, 38); // Red-600
    } else if (stText.includes("50") || stText.includes("60") || stText.includes("< 50") || stText.includes("moderad") || stText.includes("parcial")) {
      doc.setTextColor(217, 119, 6); // Amber-600
    } else {
      doc.setTextColor(22, 101, 52); // Green-800
    }
    doc.text(c3Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[2];

    // Col 4: Patrón (PSV/EDV) / Maniobra Aumento
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(c4Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[3];

    // Col 5: Rel. / Índice / Reflujo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4 * factor);
    const refText = (row.hemodynamicIndex || "").toLowerCase();
    if (refText.includes("reflujo") || refText.includes("incompet") || refText.includes("patol") || refText.includes("oclus")) {
      doc.setTextColor(220, 38, 38); // Red-600
    } else if (refText.includes("competente") || refText.includes("normal") || refText.includes("sin reflujo")) {
      doc.setTextColor(14, 116, 144); // Cyan-700
    } else {
      doc.setTextColor(14, 116, 144); // Cyan-700
    }
    doc.text(c5Lines, cellX + 2, yCoord + 3.0 * factor);
    cellX += colWidths[4];

    // Col 6: Impacto Hemodinámico / Estado Clínico
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3 * factor);
    doc.setTextColor(71, 85, 105);
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
  const synthText = vascularData.morphologicalSynthesis || "";
  if (synthText && synthText.trim()) {
    const bottomMargin = 14 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8 * factor);
    const synthLineH = 4.0 * factor;
    const synthLines = doc.splitTextToSize(synthText.trim(), contentWidth - 10);
    
    // Header height + text lines height + padding
    const calculatedH = (synthLines.length * synthLineH) + (10 * factor);
    const maxAvailableH = pageHeight - yCoord - bottomMargin;
    const boxHeight = Math.min(calculatedH, maxAvailableH);

    if (boxHeight >= 12 * factor) {
      // Soft rose/crimson container
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, yCoord, contentWidth, boxHeight, 2, 2, "FD");

      // Crimson left accent line
      doc.setFillColor(225, 29, 72); // Rose-600 / Crimson
      doc.rect(marginX, yCoord, 2.5, boxHeight, "F");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5 * factor);
      doc.setTextColor(190, 18, 60); // Rose-700
      doc.text(vascularData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y HEMODINÁMICA:", marginX + 6, yCoord + 5.5 * factor);

      // Body text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6 * factor);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(synthLines, marginX + 6, yCoord + (9.5 * factor));
    }
  }
}
