import type { jsPDF } from "jspdf";
import {
  getFindingsMapTemplate,
  positionedItems,
  type FindingsMapData,
} from "../lib/findingsMap";
import { sanitizePdfText } from "./sanitizePdfText";

function wrapText(doc: jsPDF, text: string, maxW: number, maxLines: number): string[] {
  const lines = doc.splitTextToSize(sanitizePdfText(text), maxW) as string[];
  return lines.slice(0, maxLines);
}

/**
 * Full-page annex: numbered findings map (silhouette + legend).
 */
export async function renderFindingsMapAnnexToPDF(
  doc: jsPDF,
  data: FindingsMapData,
  opts?: { clinicName?: string }
): Promise<void> {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: MAPA DE HALLAZGOS NUMERADOS", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const subtitle = `${sanitizePdfText(data.studyRegion)} · ${data.viewOrientation} · ${getFindingsMapTemplate(data.templateId).label}`;
  doc.text(subtitle, margin, 22);
  if (opts?.clinicName) {
    doc.text(sanitizePdfText(opts.clinicName).slice(0, 60), pageW - margin, 16, { align: "right" });
  }

  const template = getFindingsMapTemplate(data.templateId);
  const pins = positionedItems(data);

  // Map panel (left)
  const mapX = margin;
  const mapY = 28;
  const mapW = pageW * 0.42;
  const mapH = pageH - mapY - 28;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(mapX, mapY, mapW, mapH, 3, 3, "FD");

  // Simplified body box inside map
  const innerPad = 10;
  const bodyX = mapX + innerPad;
  const bodyY = mapY + innerPad + 6;
  const bodyW = mapW - innerPad * 2;
  const bodyH = mapH - innerPad * 2 - 10;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(bodyX, bodyY, bodyW, bodyH, 8, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText(template.label).toUpperCase(), mapX + mapW / 2, mapY + 8, {
    align: "center",
  });

  pins.forEach((pin) => {
    const px = bodyX + ((pin.x || 50) / 100) * bodyW;
    const py = bodyY + ((pin.y || 50) / 100) * bodyH;
    const r = pin.severity === "primary" ? 4.2 : 3.6;
    if (pin.severity === "primary") doc.setFillColor(245, 158, 11);
    else doc.setFillColor(14, 165, 233);
    doc.circle(px, py, r, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(pin.n), px, py + 1.1, { align: "center" });
  });

  // Legend (right)
  let ly = mapY + 4;
  const legendX = mapX + mapW + 8;
  const legendW = pageW - margin - legendX;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.title || "Mapa de hallazgos"), legendX, ly);
  ly += 7;

  if (data.priorInstructions) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const instr = wrapText(doc, `Instrucciones: ${data.priorInstructions}`, legendW, 3);
    instr.forEach((line) => {
      doc.text(line, legendX, ly);
      ly += 3.5;
    });
    ly += 2;
  }

  pins.forEach((pin) => {
    if (ly > pageH - 20) return;
    if (pin.severity === "primary") doc.setFillColor(245, 158, 11);
    else doc.setFillColor(14, 165, 233);
    doc.circle(legendX + 3.5, ly + 1, 3.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(pin.n), legendX + 3.5, ly + 2.1, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const titleLines = wrapText(doc, pin.label, legendW - 12, 2);
    let ty = ly;
    titleLines.forEach((line) => {
      doc.text(line, legendX + 9, ty + 2);
      ty += 3.6;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const meta = [pin.slotLabel, pin.side, pin.figureRef ? `Fig. ${pin.figureRef}` : ""]
      .filter(Boolean)
      .join(" · ");
    if (meta) {
      doc.text(sanitizePdfText(meta), legendX + 9, ty + 1.5);
      ty += 4;
    }
    if (pin.detail) {
      const detailLines = wrapText(doc, pin.detail, legendW - 12, 2);
      detailLines.forEach((line) => {
        doc.text(line, legendX + 9, ty + 1);
        ty += 3.3;
      });
    }
    ly = ty + 5;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Esquema orientativo. La numeración sigue el orden de mención / figuras del informe.",
    margin,
    pageH - 10
  );
}
