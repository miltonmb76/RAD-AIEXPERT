import { ClinicalScorecardData } from "../types";
import { criterionStatusLabel, criterionWeightLabel, scorecardTrafficLabel } from "../lib/clinicalIntelligence";

function sanitizePdfText(input: string): string {
  return (input || "")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/–|—/g, "-")
    .replace(/[^\x00-\x7F]/g, (ch) => {
      try {
        return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      } catch {
        return "?";
      }
    });
}

/**
 * Larger, page-filling scorecard annex.
 * Prefers a single page; the final synthesis box may jump if content is tall.
 * Recommendations render only when present (opt-in from UI).
 */
export function renderScorecardAnnexToPDF(
  doc: any,
  scorecard: ClinicalScorecardData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!scorecard || !scorecard.criteria?.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 16 * factor;
  const hasReco = !!(scorecard.recommendation && scorecard.recommendation.trim());

  // Typography tuned to fill the page without becoming huge
  const fsTitle = 14 * factor;
  const fsBanner = 11 * factor;
  const fsMeta = 9.5 * factor;
  const fsTable = 9.2 * factor;
  const fsBody = 9.5 * factor;
  const lineTable = 4.4 * factor;
  const lineBody = 4.6 * factor;
  const headerH = 8.5 * factor;

  doc.addPage();
  let y = 20 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: SCORECARD DE CRITERIOS CLINICOS", marginX, y);
  y += 5.5 * factor;

  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  const title = sanitizePdfText(`${scorecard.protocolName} — ${scorecard.categoryAssigned}`);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  const titleLines = doc.splitTextToSize(title, contentWidth - 16 * factor);
  const bannerH = Math.max(16 * factor, titleLines.length * 5.2 * factor + 12 * factor);
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(20, 184, 166);
  doc.rect(marginX, y, 3.8 * factor, bannerH, "F");

  doc.setTextColor(17, 94, 89);
  let ty = y + 6 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, ty);
    ty += 5.2 * factor;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsMeta);
  doc.setTextColor(51, 65, 85);
  doc.text(
    sanitizePdfText(
      `Criterios positivos: ${scorecard.scoreMet}/${scorecard.scoreTotal}   |   Semaforo: ${scorecardTrafficLabel(scorecard.trafficLight)}`
    ),
    marginX + 8 * factor,
    y + bannerH - 4 * factor
  );
  y += bannerH + 7 * factor;

  const cols = [
    { key: "criterion", label: "Criterio", w: contentWidth * 0.24 },
    { key: "status", label: "Estado", w: contentWidth * 0.13 },
    { key: "value", label: "Valor", w: contentWidth * 0.13 },
    { key: "evidence", label: "Evidencia del informe", w: contentWidth * 0.34 },
    { key: "weight", label: "Peso", w: contentWidth * 0.16 },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(15, 118, 110);
    doc.rect(marginX, y, contentWidth, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsTable);
    doc.setTextColor(255, 255, 255);
    let x = marginX + 2.5 * factor;
    cols.forEach((c) => {
      doc.text(c.label, x, y + 5.6 * factor);
      x += c.w;
    });
    y += headerH;
  };

  drawTableHeader();

  const rows = scorecard.criteria;
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsTable);
    const cells = [
      sanitizePdfText(row.criterion || ""),
      sanitizePdfText(criterionStatusLabel(row.status)),
      sanitizePdfText(row.value || "-"),
      sanitizePdfText(row.evidence || ""),
      sanitizePdfText(criterionWeightLabel(row.weight || "")),
    ];
    const wrapped = cells.map((text, i) => doc.splitTextToSize(text, cols[i].w - 3.5 * factor));
    const rowH = Math.max(10 * factor, Math.max(...wrapped.map((w: string[]) => w.length)) * lineTable + 4 * factor);

    // Keep room for synthesis on first page when possible; allow jump near the end
    const remainingRows = rows.length - ri;
    const reserveForSummary =
      remainingRows <= 2 ? 0 : 22 * factor; // last rows may push summary to next page

    if (y + rowH > pageBottom - reserveForSummary) {
      doc.addPage();
      y = 20 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("SCORECARD — Continuacion", marginX, y);
      y += 8 * factor;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fsTable);
    }

    const bg =
      row.status === "met"
        ? [236, 253, 245]
        : row.status === "equivocal"
          ? [255, 251, 235]
          : [248, 250, 252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, y, contentWidth, rowH, "FD");

    doc.setTextColor(30, 41, 59);
    let x = marginX + 2.5 * factor;
    wrapped.forEach((lines: string[], i: number) => {
      let cy = y + 5 * factor;
      lines.forEach((ln) => {
        doc.text(ln, x, cy);
        cy += lineTable;
      });
      x += cols[i].w;
    });
    y += rowH;
  }

  y += 7 * factor;

  const drawTextBox = (
    label: string,
    body: string,
    fill: number[],
    stroke: number[],
    labelColor: number[],
    bodyColor: number[],
    allowNewPage: boolean
  ) => {
    if (!body.trim()) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    const lines = doc.splitTextToSize(sanitizePdfText(body), contentWidth - 14 * factor);
    const boxH = 12 * factor + lines.length * lineBody;
    if (allowNewPage && y + boxH > pageBottom) {
      doc.addPage();
      y = 20 * factor;
    }
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsMeta);
    doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
    doc.text(label, marginX + 5 * factor, y + 6 * factor);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    doc.setTextColor(bodyColor[0], bodyColor[1], bodyColor[2]);
    let sy = y + 12 * factor;
    lines.forEach((ln: string) => {
      doc.text(ln, marginX + 5 * factor, sy);
      sy += lineBody;
    });
    y += boxH + 5 * factor;
  };

  // Final synoptic box may jump to next page if the table already filled the page
  drawTextBox(
    "Sintesis clinica",
    scorecard.clinicalSummary || "",
    [248, 250, 252],
    [203, 213, 225],
    [71, 85, 105],
    [51, 65, 85],
    true
  );

  if (hasReco) {
    drawTextBox(
      "Conducta sugerida",
      scorecard.recommendation || "",
      [240, 253, 250],
      [153, 246, 228],
      [17, 94, 89],
      [19, 78, 74],
      true
    );
  }
}
