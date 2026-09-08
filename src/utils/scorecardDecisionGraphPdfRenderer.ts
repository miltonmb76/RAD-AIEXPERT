import { ProtocolDecisionGraphData } from "../types";
import { protocolGraphKindLabel, protocolGraphStatusLabel } from "../lib/scorecardReasoningBridge";
import { scorecardTrafficLabel } from "../lib/clinicalIntelligence";

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

function statusFill(status?: string): [number, number, number] {
  switch (status) {
    case "met":
      return [16, 185, 129];
    case "not_met":
      return [244, 63, 94];
    case "equivocal":
      return [245, 158, 11];
    case "outcome":
      return [20, 184, 166];
    case "not_mentioned":
      return [100, 116, 139];
    default:
      return [14, 165, 233];
  }
}

export function renderScorecardDecisionGraphAnnexToPDF(
  doc: any,
  graph: ProtocolDecisionGraphData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 16 * factor;
  const fsTitle = 13 * factor;
  const fsBanner = 10.5 * factor;
  const fsMeta = 9 * factor;
  const fsBody = 9.2 * factor;
  const lineBody = 4.3 * factor;

  let y = 20 * factor;
  const ensureSpace = (needed: number) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 18 * factor;
  };

  doc.addPage();
  y = 20 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: PUENTE SCORECARD - GRAFO DE DECISION", marginX, y);
  y += 5.5 * factor;

  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  const banner = sanitizePdfText(
    `${graph.protocolName} — ${graph.outcomeLabel || graph.categoryAssigned}`
  );
  const meta = sanitizePdfText(
    `Criterios: ${graph.scoreMet}/${graph.scoreTotal}  |  Semaforo: ${scorecardTrafficLabel(graph.trafficLight)}`
  );
  const bannerLines = doc.splitTextToSize(banner, contentWidth - 14 * factor);
  const metaLines = doc.splitTextToSize(meta, contentWidth - 14 * factor);
  const bannerH = Math.max(16 * factor, (bannerLines.length + metaLines.length) * 4.8 * factor + 10 * factor);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(20, 184, 166);
  doc.rect(marginX, y, 3.5 * factor, bannerH, "F");

  let ty = y + 6 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  doc.setTextColor(17, 94, 89);
  bannerLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 4.8 * factor;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsMeta);
  doc.setTextColor(51, 65, 85);
  metaLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 4.5 * factor;
  });
  y += bannerH + 6 * factor;

  graph.nodes.forEach((node, idx) => {
    const fill = statusFill(node.status);
    const title = sanitizePdfText(
      `${idx + 1}. [${protocolGraphKindLabel(node.kind)}] ${node.label}`
    );
    const statusLine = sanitizePdfText(
      `${protocolGraphStatusLabel(node.status)}${node.value ? `  |  Valor: ${node.value}` : ""}`
    );
    const titleLines = doc.splitTextToSize(title, contentWidth - 12 * factor);
    const statusLines = doc.splitTextToSize(statusLine, contentWidth - 12 * factor);
    const detailLines = node.detail
      ? doc.splitTextToSize(sanitizePdfText(node.detail), contentWidth - 12 * factor)
      : [];
    const evidenceLines = node.evidence
      ? doc.splitTextToSize(sanitizePdfText(`Evidencia: ${node.evidence}`), contentWidth - 12 * factor)
      : [];
    const cardH =
      7 * factor +
      titleLines.length * 4.6 * factor +
      statusLines.length * 4 * factor +
      detailLines.length * lineBody +
      evidenceLines.length * lineBody +
      4 * factor;

    ensureSpace(cardH + 3 * factor);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, cardH, 1.5, 1.5, "FD");
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(marginX, y, 2.8 * factor, cardH, "F");

    let cy = y + 5.5 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.setTextColor(15, 23, 42);
    titleLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += 4.6 * factor;
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(71, 85, 105);
    statusLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += 4 * factor;
    });
    doc.setTextColor(51, 65, 85);
    detailLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += lineBody;
    });
    doc.setTextColor(100, 116, 139);
    evidenceLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += lineBody;
    });

    y += cardH + 3.2 * factor;
  });

  if (graph.pathNarrative) {
    const lines = doc.splitTextToSize(
      sanitizePdfText(`Narrativa del recorrido: ${graph.pathNarrative}`),
      contentWidth - 12 * factor
    );
    const boxH = 8 * factor + lines.length * lineBody;
    ensureSpace(boxH);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
    let sy = y + 5.5 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(15, 118, 110);
    lines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, sy);
      sy += lineBody;
    });
  }
}
