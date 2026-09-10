import { ClinicalScorecardData } from "../types";
import { criterionStatusLabel, scorecardTrafficLabel } from "../lib/clinicalIntelligence";

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
  const pageBottom = pageHeight - 18 * factor;

  doc.addPage();
  let y = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: SCORECARD DE CRITERIOS CLINICOS", marginX, y);
  y += 4.5 * factor;

  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  // Header banner
  const title = sanitizePdfText(
    `${scorecard.protocolName} — ${scorecard.categoryAssigned}`
  );
  const titleLines = doc.splitTextToSize(title, contentWidth - 16 * factor);
  const bannerH = Math.max(14 * factor, titleLines.length * 4.5 * factor + 10 * factor);
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(20, 184, 166);
  doc.rect(marginX, y, 3.5 * factor, bannerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5 * factor);
  doc.setTextColor(17, 94, 89);
  let ty = y + 5.5 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, ty);
    ty += 4.5 * factor;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8 * factor);
  doc.setTextColor(51, 65, 85);
  const meta = sanitizePdfText(
    `Criterios positivos: ${scorecard.scoreMet}/${scorecard.scoreTotal}   |   Semaforo: ${scorecardTrafficLabel(scorecard.trafficLight)}`
  );
  doc.text(meta, marginX + 8 * factor, y + bannerH - 3.5 * factor);
  y += bannerH + 6 * factor;

  // Table header
  const cols = [
    { key: "criterion", label: "Criterio", w: contentWidth * 0.22 },
    { key: "status", label: "Estado", w: contentWidth * 0.14 },
    { key: "value", label: "Valor", w: contentWidth * 0.12 },
    { key: "evidence", label: "Evidencia del informe", w: contentWidth * 0.36 },
    { key: "weight", label: "Peso", w: contentWidth * 0.16 },
  ];

  const drawTableHeader = () => {
    doc.setFillColor(15, 118, 110);
    doc.rect(marginX, y, contentWidth, 7 * factor, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(255, 255, 255);
    let x = marginX + 2 * factor;
    cols.forEach((c) => {
      doc.text(c.label, x, y + 4.6 * factor);
      x += c.w;
    });
    y += 7 * factor;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2 * factor);

  for (const row of scorecard.criteria) {
    const cells = [
      sanitizePdfText(row.criterion || ""),
      sanitizePdfText(criterionStatusLabel(row.status)),
      sanitizePdfText(row.value || "-"),
      sanitizePdfText(row.evidence || ""),
      sanitizePdfText(row.weight || ""),
    ];
    const wrapped = cells.map((text, i) => doc.splitTextToSize(text, cols[i].w - 3 * factor));
    const rowH = Math.max(8 * factor, Math.max(...wrapped.map((w: string[]) => w.length)) * 3.6 * factor + 3 * factor);

    if (y + rowH > pageBottom - 28 * factor) {
      doc.addPage();
      y = 22 * factor;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10 * factor);
      doc.setTextColor(15, 23, 42);
      doc.text("SCORECARD — Continuacion", marginX, y);
      y += 8 * factor;
      drawTableHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2 * factor);
    }

    const bg = row.status === "met" ? [236, 253, 245] : row.status === "equivocal" ? [255, 251, 235] : [248, 250, 252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, y, contentWidth, rowH, "FD");

    doc.setTextColor(30, 41, 59);
    let x = marginX + 2 * factor;
    wrapped.forEach((lines: string[], i: number) => {
      let cy = y + 4 * factor;
      lines.forEach((ln) => {
        doc.text(ln, x, cy);
        cy += 3.6 * factor;
      });
      x += cols[i].w;
    });
    y += rowH;
  }

  y += 6 * factor;
  const ensureSpace = (need: number) => {
    if (y + need > pageBottom) {
      doc.addPage();
      y = 22 * factor;
    }
  };

  const summary = sanitizePdfText(scorecard.clinicalSummary || "");
  const reco = sanitizePdfText(scorecard.recommendation || "");
  const summaryLines = doc.splitTextToSize(summary, contentWidth - 12 * factor);
  const recoLines = doc.splitTextToSize(reco, contentWidth - 12 * factor);

  ensureSpace(18 * factor + summaryLines.length * 3.8 * factor);
  let boxH = 10 * factor + summaryLines.length * 3.8 * factor;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  doc.setTextColor(71, 85, 105);
  doc.text("Sintesis clinica", marginX + 5 * factor, y + 5 * factor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(51, 65, 85);
  let sy = y + 10 * factor;
  summaryLines.forEach((ln: string) => {
    doc.text(ln, marginX + 5 * factor, sy);
    sy += 3.8 * factor;
  });
  y += boxH + 4 * factor;

  ensureSpace(18 * factor + recoLines.length * 3.8 * factor);
  boxH = 10 * factor + recoLines.length * 3.8 * factor;
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  doc.setTextColor(17, 94, 89);
  doc.text("Conducta sugerida", marginX + 5 * factor, y + 5 * factor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(19, 78, 74);
  sy = y + 10 * factor;
  recoLines.forEach((ln: string) => {
    doc.text(ln, marginX + 5 * factor, sy);
    sy += 3.8 * factor;
  });

  if (scorecard.atlasOverlays?.length) {
    y += boxH + 5 * factor;
    ensureSpace(10 * factor);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(
        `Integracion Atlas: ${scorecard.atlasOverlays.length} marcadores de patologia activa disponibles para overlay 3D.`
      ),
      marginX,
      y
    );
  }
}
