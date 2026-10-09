import type { jsPDF } from "jspdf";
import {
  getFindingsMapTemplate,
  positionedItems,
  type FindingsMapData,
  type FindingsMapTemplateId,
} from "../lib/findingsMap";
import { sanitizePdfText } from "./sanitizePdfText";

function wrapText(doc: jsPDF, text: string, maxW: number, maxLines: number): string[] {
  const lines = doc.splitTextToSize(sanitizePdfText(text), maxW) as string[];
  return lines.slice(0, maxLines);
}

/** Map percent coords (viewBox 0–100 × 0–120) into the draw box. */
function pctToPage(
  box: { x: number; y: number; w: number; h: number },
  px: number,
  py: number
) {
  return {
    x: box.x + (px / 100) * box.w,
    y: box.y + (py / 120) * box.h,
  };
}

/**
 * Draw a recognizable anatomical silhouette so pins aren't floating in an empty box.
 * Coordinates use the same 0–100 × 0–120 space as SVG templates.
 */
function drawTemplateSilhouette(
  doc: jsPDF,
  templateId: FindingsMapTemplateId,
  box: { x: number; y: number; w: number; h: number }
) {
  const p = (px: number, py: number) => pctToPage(box, px, py);
  const rx = (r: number) => (r / 100) * box.w;
  const ry = (r: number) => (r / 120) * box.h;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.6);

  switch (templateId) {
    case "neck": {
      // Head
      const head = p(50, 16);
      doc.setFillColor(226, 232, 240);
      doc.ellipse(head.x, head.y, rx(13), ry(11), "FD");
      // Neck / soft tissue
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(p(34, 28).x, p(34, 28).y, rx(32), ry(52), 3, 3, "FD");
      // Thyroid lobes
      doc.setFillColor(203, 213, 225);
      doc.setDrawColor(100, 116, 139);
      const lr = p(38, 52);
      const ll = p(62, 52);
      doc.ellipse(lr.x, lr.y, rx(11), ry(16), "FD");
      doc.ellipse(ll.x, ll.y, rx(11), ry(16), "FD");
      // Isthmus
      doc.setFillColor(148, 163, 184);
      doc.roundedRect(p(46, 48).x, p(46, 48).y, rx(8), ry(10), 1, 1, "FD");
      // Node guide circles
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.4);
      const nr = p(20, 46);
      const nl = p(80, 46);
      doc.circle(nr.x, nr.y, rx(5), "S");
      doc.circle(nl.x, nl.y, rx(5), "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("DER", lr.x, p(38, 92).y, { align: "center" });
      doc.text("IZQ", ll.x, p(62, 92).y, { align: "center" });
      break;
    }
    case "breast_bilateral": {
      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(100, 116, 139);
      const r = p(32, 55);
      const l = p(68, 55);
      doc.circle(r.x, r.y, rx(22), "FD");
      doc.circle(l.x, l.y, rx(22), "FD");
      doc.setFillColor(148, 163, 184);
      doc.circle(r.x, r.y, rx(3), "F");
      doc.circle(l.x, l.y, rx(3), "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("DER", r.x, p(32, 90).y, { align: "center" });
      doc.text("IZQ", l.x, p(68, 90).y, { align: "center" });
      break;
    }
    case "abdomen": {
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(p(22, 18).x, p(22, 18).y, rx(56), ry(84), 8, 8, "FD");
      doc.setFillColor(203, 213, 225);
      doc.ellipse(p(38, 40).x, p(38, 40).y, rx(10), ry(14), "F");
      doc.ellipse(p(62, 42).x, p(62, 42).y, rx(9), ry(12), "F");
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.5);
      // Cross guides
      doc.line(p(50, 22).x, p(50, 22).y, p(50, 98).x, p(50, 98).y);
      doc.line(p(26, 58).x, p(26, 58).y, p(74, 58).x, p(74, 58).y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text("HCD", p(38, 30).x, p(38, 30).y, { align: "center" });
      doc.text("HCI", p(64, 30).x, p(64, 30).y, { align: "center" });
      doc.text("FID", p(38, 78).x, p(38, 78).y, { align: "center" });
      doc.text("FII", p(64, 78).x, p(64, 78).y, { align: "center" });
      break;
    }
    case "chest": {
      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(100, 116, 139);
      // Simple thorax diamond-ish via ellipse pair
      doc.ellipse(p(50, 50).x, p(50, 50).y, rx(28), ry(34), "FD");
      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.line(p(50, 22).x, p(50, 22).y, p(50, 82).x, p(50, 82).y);
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("DER", p(34, 50).x, p(34, 50).y, { align: "center" });
      doc.text("IZQ", p(66, 50).x, p(66, 50).y, { align: "center" });
      break;
    }
    case "scrotum": {
      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(100, 116, 139);
      doc.ellipse(p(38, 55).x, p(38, 55).y, rx(16), ry(22), "FD");
      doc.ellipse(p(62, 55).x, p(62, 55).y, rx(16), ry(22), "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("DER", p(38, 90).x, p(38, 90).y, { align: "center" });
      doc.text("IZQ", p(62, 90).x, p(62, 90).y, { align: "center" });
      break;
    }
    case "body_anterior": {
      doc.setFillColor(226, 232, 240);
      doc.setDrawColor(100, 116, 139);
      doc.ellipse(p(50, 14).x, p(50, 14).y, rx(8), ry(9), "FD");
      doc.roundedRect(p(34, 24).x, p(34, 24).y, rx(32), ry(62), 6, 6, "FD");
      // Arms hint
      doc.setFillColor(203, 213, 225);
      doc.roundedRect(p(16, 30).x, p(16, 30).y, rx(16), ry(22), 3, 3, "FD");
      doc.roundedRect(p(68, 30).x, p(68, 30).y, rx(16), ry(22), 3, 3, "FD");
      // Legs
      doc.roundedRect(p(38, 88).x, p(38, 88).y, rx(8), ry(22), 2, 2, "FD");
      doc.roundedRect(p(54, 88).x, p(54, 88).y, rx(8), ry(22), 2, 2, "FD");
      break;
    }
    case "msk_joint": {
      doc.setFillColor(226, 232, 240);
      doc.ellipse(p(50, 55).x, p(50, 55).y, rx(28), ry(32), "FD");
      doc.setFillColor(203, 213, 225);
      doc.ellipse(p(50, 55).x, p(50, 55).y, rx(10), ry(12), "F");
      doc.setDrawColor(148, 163, 184);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.line(p(50, 22).x, p(50, 22).y, p(50, 88).x, p(50, 88).y);
      doc.setLineDashPattern([], 0);
      break;
    }
    default: {
      // Generic grid
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(p(10, 10).x, p(10, 10).y, rx(80), ry(100), 4, 4, "FD");
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.35);
      doc.line(p(10, 43).x, p(10, 43).y, p(90, 43).x, p(90, 43).y);
      doc.line(p(10, 76).x, p(10, 76).y, p(90, 76).x, p(90, 76).y);
      doc.line(p(37, 10).x, p(37, 10).y, p(37, 110).x, p(37, 110).y);
      doc.line(p(63, 10).x, p(63, 10).y, p(63, 110).x, p(63, 110).y);
      break;
    }
  }
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
  const template = getFindingsMapTemplate(data.templateId);
  const subtitle = `${sanitizePdfText(data.studyRegion)} · ${data.viewOrientation} · ${template.label}`;
  doc.text(subtitle, margin, 22);
  if (opts?.clinicName) {
    doc.text(sanitizePdfText(opts.clinicName).slice(0, 60), pageW - margin, 16, { align: "right" });
  }

  const pins = positionedItems(data);

  // Map panel (left) — keep aspect closer to SVG viewBox 100×120
  const mapX = margin;
  const mapY = 28;
  const mapW = pageW * 0.42;
  const mapH = pageH - mapY - 28;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(mapX, mapY, mapW, mapH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(sanitizePdfText(template.label).toUpperCase(), mapX + mapW / 2, mapY + 8, {
    align: "center",
  });

  const innerPad = 8;
  const availW = mapW - innerPad * 2;
  const availH = mapH - innerPad * 2 - 10;
  // Fit 100×120 aspect inside available area
  const scale = Math.min(availW / 100, availH / 120);
  const bodyW = 100 * scale;
  const bodyH = 120 * scale;
  const bodyX = mapX + (mapW - bodyW) / 2;
  const bodyY = mapY + 12 + (availH - bodyH) / 2;
  const box = { x: bodyX, y: bodyY, w: bodyW, h: bodyH };

  drawTemplateSilhouette(doc, data.templateId, box);

  pins.forEach((pin) => {
    const { x: px, y: py } = pctToPage(box, pin.x || 50, pin.y || 50);
    const r = pin.severity === "primary" ? 4.2 : 3.6;
    // Halo for readability over silhouette
    doc.setFillColor(255, 255, 255);
    doc.circle(px, py, r + 1.1, "F");
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
