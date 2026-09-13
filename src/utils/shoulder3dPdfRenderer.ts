import jsPDF from "jspdf";
import { Shoulder3DData, Shoulder3DPanel, ShoulderFindingRow } from "../types";

/**
 * Renders an exclusive, full-page "ANEXO: SUITE HOMBRO 3D & FICHA MANGUITO ROTADOR" into the provided jsPDF document.
 */
export async function renderShoulder3DPageToPdf(
  doc: jsPDF,
  shoulderData: Shoulder3DData,
  pageSize: "letter" | "a4" = "letter",
  pdfLayoutType: string = "modern"
): Promise<void> {
  if (!shoulderData || (!shoulderData.panels?.length && !shoulderData.findingTable?.length)) {
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2);
  const factor = pageSize === "a4" ? 1.0 : 0.98;
  const accent: [number, number, number] = [217, 119, 6]; // amber-600

  doc.addPage();

  let yCoord = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: SUITE HOMBRO 3D & FICHA MANGUITO ROTADOR", marginX, yCoord);
  yCoord += 4.5 * factor;

  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.8);
  doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
  yCoord += 6.5 * factor;

  const territory = shoulderData.territoryLabel || "ECOGRAFÍA DE HOMBRO";
  const figTitle = shoulderData.figureTitle || `FIGURA 1. ATLAS 3D HOMBRO Y CORRELACIÓN MANGUITO — ${territory.toUpperCase()}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  doc.setTextColor(30, 41, 59);
  const figTitleLines = doc.splitTextToSize(figTitle.toUpperCase(), contentWidth - 10);
  const figBannerH = Math.max(7.5 * factor, (figTitleLines.length * 4.2 + 3) * factor);

  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, yCoord, contentWidth, figBannerH, 1.5, 1.5, "FD");

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(marginX, yCoord, 2.5, figBannerH, "F");

  doc.text(figTitleLines, marginX + 5, yCoord + (figBannerH / 2) + 1.2);
  yCoord += figBannerH + 4 * factor;

  const panels: Shoulder3DPanel[] = (shoulderData.panels || []).filter(p => p && (p.imageUrl || p.panelTitle));
  const panelCount = Math.min(Math.max(panels.length, 1), 3);

  if (panelCount > 0) {
    const gap = panelCount === 3 ? 3.5 : 5;
    const totalGaps = (panelCount - 1) * gap;
    const cardWidth = (contentWidth - totalGaps) / panelCount;
    const imgWidth = cardWidth - 4;
    const imgHeight = imgWidth * (3 / 4);

    const measureCaptionH = (p: Shoulder3DPanel): number => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      let h = 3.2 * factor;
      h += titleLines.length * 3.4 * factor;
      if (p.anatomicalFocus && String(p.anatomicalFocus).trim()) {
        h += 1.0 * factor;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2 * factor);
        const descLines = doc.splitTextToSize(String(p.anatomicalFocus).trim(), cardWidth - 6);
        h += descLines.length * 3.05 * factor;
      }
      h += 2.2 * factor;
      return h;
    };
    const captionAreaH = Math.max(
      ...panels.slice(0, panelCount).map(measureCaptionH),
      7 * factor
    );
    const cardH = imgHeight + captionAreaH + 4;

    for (let idx = 0; idx < panelCount; idx++) {
      const p = panels[idx];
      const cardX = marginX + idx * (cardWidth + gap);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(cardX, yCoord, cardWidth, cardH, 2, 2, "FD");

      const imgX = cardX + 2;
      const imgY = yCoord + 2;

      if (p.imageUrl && p.imageUrl.startsWith("data:image")) {
        try {
          const imgFormat = p.imageUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(p.imageUrl, imgFormat, imgX, imgY, imgWidth, imgHeight);
        } catch (imgErr) {
          console.warn("Error drawing shoulder 3D image to PDF:", imgErr);
          doc.setFillColor(241, 245, 249);
          doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
        }
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8 * factor);
        doc.setTextColor(148, 163, 184);
        doc.text("Reconstrucción 3D Hombro", imgX + (imgWidth / 2) - 18, imgY + (imgHeight / 2));
      }

      const badgeW = 20 * factor;
      const badgeH = 5 * factor;
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.roundedRect(imgX + 2, imgY + 2, badgeW, badgeH, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(255, 255, 255);
      doc.text(`PANEL ${p.panelLetter || String.fromCharCode(65 + idx)}`, imgX + 3.5, imgY + 2 + 3.6);

      let textY = imgY + imgHeight + 3.2 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(p.panelTitle || `Panel ${p.panelLetter}`, cardWidth - 6);
      doc.text(titleLines, cardX + 3, textY);
      textY += titleLines.length * 3.4 * factor;

      if (p.anatomicalFocus && String(p.anatomicalFocus).trim()) {
        textY += 1.0 * factor;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2 * factor);
        doc.setTextColor(71, 85, 105);
        const descLines = doc.splitTextToSize(String(p.anatomicalFocus).trim(), cardWidth - 6);
        doc.text(descLines, cardX + 3, textY);
      }
    }

    yCoord += cardH + 5 * factor;
  }

  const dossierBlocks: Array<{ title: string; text: string; color: [number, number, number] }> = [
    { title: "RESUMEN DEL HOMBRO", text: String(shoulderData.shoulderSummary || "").trim(), color: accent },
    { title: "MORFOLOGÍA / TENDÓN DOMINANTE", text: String(shoulderData.morphologyNotes || "").trim(), color: [234, 88, 12] },
    { title: "ESTADO DEL MANGUITO", text: String(shoulderData.cuffStatus || "").trim(), color: [180, 83, 9] },
  ];
  const keyPoints = Array.isArray(shoulderData.keyPoints) ? shoulderData.keyPoints.filter(Boolean) : [];
  if (keyPoints.length) {
    dossierBlocks.push({
      title: "PUNTOS CLAVE",
      text: keyPoints.map((k) => `• ${k}`).join("\n"),
      color: [5, 150, 105],
    });
  }

  const dossierTexts = dossierBlocks.filter((b) => b.text);
  if (dossierTexts.length) {
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
    doc.text("FICHA CLÍNICA HOMBRO / MANGUITO (CORRELACIÓN CON LA FIGURA 3D)", marginX, dossierY);
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
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(253, 230, 138);
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

  // Fixed 8-col finding table (matches UI / API contract)
  const tableData: ShoulderFindingRow[] = shoulderData.findingTable || [];
  const tableTitle = shoulderData.tableTitle || "TABLA ECOGRÁFICA DEL MANGUITO ROTADOR Y ESTRUCTURAS PERIARTICULARES:";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(tableTitle.toUpperCase(), marginX, yCoord);
  yCoord += 3.5 * factor;

  const colWidths = [
    contentWidth * 0.14,
    contentWidth * 0.13,
    contentWidth * 0.12,
    contentWidth * 0.14,
    contentWidth * 0.12,
    contentWidth * 0.12,
    contentWidth * 0.10,
    contentWidth * 0.13
  ];

  const headerLabels = [
    "LOCALIZACIÓN",
    "ESTRUCTURA",
    "GROSOR / GAP",
    "PATRÓN ECO",
    "BURSA",
    "DINÁMICA",
    "SEVERIDAD",
    "IMPACTO"
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2 * factor);
  doc.setTextColor(51, 65, 85);

  const wrappedHeaders = headerLabels.map((lbl, i) => {
    return doc.splitTextToSize(lbl, colWidths[i] - 2.5);
  });

  const maxHeaderLines = Math.max(...wrappedHeaders.map(lines => lines.length), 1);
  const headerH = Math.max(7.2 * factor, (maxHeaderLines * 2.9 + 2.5) * factor);

  doc.setFillColor(255, 247, 237); // orange-50
  doc.rect(marginX, yCoord, contentWidth, headerH, "F");

  let curX = marginX;
  wrappedHeaders.forEach((lines, i) => {
    doc.text(lines, curX + 1.5, yCoord + 3.0 * factor);
    curX += colWidths[i];
  });

  doc.setDrawColor(253, 186, 116);
  doc.setLineWidth(0.4);
  doc.line(marginX, yCoord + headerH, marginX + contentWidth, yCoord + headerH);
  yCoord += headerH;

  const visibleRows = tableData.slice(0, 8);

  visibleRows.forEach((row, rIdx) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6 * factor);

    const cells = [
      row.location || "",
      row.structure || "",
      row.thicknessOrGap || "",
      row.echoPattern || "",
      row.bursalStatus || "",
      row.dynamicFinding || "",
      row.severity || "",
      row.clinicalImpact || ""
    ];
    const cellLines = cells.map((c, i) => doc.splitTextToSize(c, colWidths[i] - 2.5));
    const maxLines = Math.max(...cellLines.map(l => l.length), 1);
    const rowH = Math.max(5.4 * factor, (maxLines * 2.9 + 2.0) * factor);

    if (rIdx % 2 === 1) {
      doc.setFillColor(255, 251, 235);
      doc.rect(marginX, yCoord, contentWidth, rowH, "F");
    }

    let cellX = marginX;
    cellLines.forEach((lines, i) => {
      if (i === 0 || i === 1) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
      } else if (i === 6) {
        doc.setFont("helvetica", "bold");
        const sev = (row.severity || "").toLowerCase();
        if (sev.includes("sever") || sev.includes("completa") || sev.includes("masiv")) {
          doc.setTextColor(220, 38, 38);
        } else if (sev.includes("moderad") || sev.includes("parcial") || sev.includes("alto")) {
          doc.setTextColor(217, 119, 6);
        } else {
          doc.setTextColor(22, 101, 52);
        }
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
      }
      doc.setFontSize(6.6 * factor);
      doc.text(lines, cellX + 1.5, yCoord + 2.8 * factor);
      cellX += colWidths[i];
    });

    doc.setDrawColor(254, 243, 199);
    doc.setLineWidth(0.2);
    doc.line(marginX, yCoord + rowH, marginX + contentWidth, yCoord + rowH);

    yCoord += rowH;
  });

  doc.setDrawColor(253, 186, 116);
  doc.setLineWidth(0.4);
  doc.line(marginX, yCoord, marginX + contentWidth, yCoord);
  yCoord += 4.5 * factor;

  const synthText = shoulderData.morphologicalSynthesis || "";
  if (synthText && synthText.trim()) {
    const footerSafeBottom = pageHeight - 18 * factor;
    const synthTitle = shoulderData.synthesisTitle || "SÍNTESIS MORFOLÓGICA Y FUNCIONAL DEL MANGUITO:";
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
      doc.text("ANEXO: SUITE HOMBRO 3D & FICHA MANGUITO ROTADOR", marginX, yCoord);
      yCoord += 4 * factor;
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.6);
      doc.line(marginX, yCoord, pageWidth - marginX, yCoord);
      yCoord += 5 * factor;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8 * factor);
      doc.setTextColor(100, 116, 139);
      doc.text("Continuación — síntesis morfológica y funcional del manguito", marginX, yCoord);
      yCoord += 6 * factor;
    };

    const drawSynthChrome = (boxH: number, includeTitle: boolean) => {
      doc.setFillColor(255, 247, 237);
      doc.setDrawColor(253, 186, 116);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, yCoord, contentWidth, boxH, 2, 2, "FD");
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(marginX, yCoord, 2.5, boxH, "F");
      if (includeTitle) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5 * factor);
        doc.setTextColor(154, 52, 18);
        doc.text(synthTitle, marginX + 6, yCoord + 5.5 * factor);
      }
    };

    let lineIdx = 0;
    let firstChunk = true;

    if (footerSafeBottom - yCoord < 18 * factor) {
      startSynthContinuationPage();
      firstChunk = true;
    }

    while (lineIdx < synthLines.length) {
      const headerBlock = firstChunk ? titleBlockH : 6.5 * factor;
      const availableForLines = footerSafeBottom - yCoord - headerBlock - bottomPad;
      let maxLinesHere = Math.floor(availableForLines / synthLineH);

      if (maxLinesHere < 1) {
        startSynthContinuationPage();
        firstChunk = false;
        continue;
      }

      const chunk = synthLines.slice(lineIdx, lineIdx + maxLinesHere);
      const boxH = headerBlock + chunk.length * synthLineH + bottomPad;

      drawSynthChrome(boxH, firstChunk);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6 * factor);
      doc.setTextColor(51, 65, 85);
      let curY = yCoord + headerBlock;
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

  // Keep layout type referenced to avoid unused-param lint in strict builds
  void pdfLayoutType;
}
