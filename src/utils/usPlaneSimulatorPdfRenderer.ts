import { UsPlaneSimulatorData } from "../types";
import { buildUsPlaneBridgeLabels, pickBridgeFocalPanel } from "../lib/usPlaneBridge";
import { sanitizePdfText } from "./sanitizePdfText";

function drawContained(
  doc: any,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number
) {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || boxW;
    const ih = Number(props?.height) || boxH;
    const ratio = iw > 0 && ih > 0 ? iw / ih : 4 / 3;
    let drawW = boxW;
    let drawH = drawW / ratio;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * ratio;
    }
    const ox = x + (boxW - drawW) / 2;
    const oy = y + (boxH - drawH) / 2;
    const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, ox, oy, drawW, drawH);
  } catch {
    doc.setFillColor(241, 245, 249);
    doc.rect(x, y, boxW, boxH, "F");
  }
}

function drawLabelChips(
  doc: any,
  labels: { text: string; xPct?: number; yPct?: number }[],
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  factor: number,
  color: [number, number, number]
) {
  const placed = labels.filter(
    (l) => typeof l.xPct === "number" && typeof l.yPct === "number"
  );
  const legend = labels.filter(
    (l) => !(typeof l.xPct === "number" && typeof l.yPct === "number")
  );

  placed.slice(0, 6).forEach((l) => {
    const px = boxX + (Math.min(95, Math.max(5, l.xPct!)) / 100) * boxW;
    const py = boxY + (Math.min(95, Math.max(5, l.yPct!)) / 100) * boxH;
    const text = sanitizePdfText(l.text).slice(0, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    const tw = doc.getTextWidth(text) + 3 * factor;
    const th = 3.6 * factor;
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(px - 1, py - th + 0.8, tw, th, 0.6, 0.6, "FD");
    doc.setTextColor(255, 255, 255);
    doc.text(text, px + 0.8, py - 0.6);
  });

  if (legend.length) {
    let ly = boxY + boxH - 2.2 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6 * factor);
    legend.slice(0, 4).forEach((l) => {
      const text = sanitizePdfText(l.text).slice(0, 42);
      const tw = doc.getTextWidth(text) + 2.5 * factor;
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.roundedRect(boxX + 1.5 * factor, ly - 2.8 * factor, Math.min(tw, boxW - 3 * factor), 3.2 * factor, 0.5, 0.5, "FD");
      doc.setTextColor(248, 250, 252);
      doc.text(text, boxX + 2.2 * factor, ly - 0.6 * factor);
      ly -= 3.6 * factor;
    });
  }
}

/**
 * One-page PDF: only ECO REAL | CORTE 3D FOCAL (same axis). No overview panel.
 */
export function renderUsPlaneSimulatorAnnexToPDF(
  doc: any,
  data: UsPlaneSimulatorData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!data) return;
  const realUs = data.realUsImage?.url ? data.realUsImage : null;
  const focal = pickBridgeFocalPanel(data);
  const validFallback = (data.panels || []).filter((p) => p?.imageUrl);

  if (!realUs && !focal?.imageUrl && !validFallback.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 12 * factor;

  doc.addPage();
  let y = 18 * factor;

  // ASCII-safe title (jsPDF Helvetica breaks on ↔ and some accents)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    realUs
      ? "ANEXO: CORTE ECO - ANATOMIA (BRIDGE US-3D)"
      : "ANEXO: SIMULADOR DE PLANO ECOGRAFICO 3D",
    marginX,
    y
  );
  y += 4 * factor;

  doc.setDrawColor(8, 145, 178);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4 * factor;

  const figTitle = sanitizePdfText(
    data.figureTitle ||
      (realUs
        ? "FIGURA. ECO REAL Y CORTE 3D FOCAL"
        : "FIGURA. PLANO DE ADQUISICION ECOGRAFICA 3D")
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  const titleLines = doc.splitTextToSize(figTitle, contentWidth - 10 * factor).slice(0, 2);
  const bannerH = Math.max(7 * factor, titleLines.length * 3.5 * factor + 3 * factor);
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(165, 243, 252);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.5, 1.5, "FD");
  doc.setFillColor(8, 145, 178);
  doc.rect(marginX, y, 2.4 * factor, bannerH, "F");
  doc.setTextColor(30, 41, 59);
  let ty = y + 4 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 5.5 * factor, ty);
    ty += 3.5 * factor;
  });
  y += bannerH + 3 * factor;

  const meta = [
    data.planeLabelEs ? `Plano: ${data.planeLabelEs}` : "",
    data.detectedLaterality ? `Lado: ${data.detectedLaterality}` : "",
    data.targetStructure ? `Estructura: ${data.targetStructure}` : "",
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(meta).slice(0, 140), marginX, y);
    y += 4.2 * factor;
  }

  const gap = 3.5 * factor;
  const allLabels =
    data.bridgeLabels?.length
      ? data.bridgeLabels
      : buildUsPlaneBridgeLabels(data, realUs);

  // Exactly two images when bridge: US | focal 3D
  if (realUs && focal?.imageUrl) {
    const imgW = (contentWidth - gap) / 2;
    const imgH = Math.min(78 * factor, imgW * 0.82);
    const slots = [
      {
        url: realUs.url,
        badge: "ECO REAL",
        caption: realUs.caption || realUs.label || "Captura del estudio",
        labels: allLabels.filter((l) => l.side !== "anatomy"),
        color: [16, 185, 129] as [number, number, number],
      },
      {
        url: focal.imageUrl!,
        badge: "CORTE 3D FOCAL",
        caption: focal.panelTitle || focal.anatomicalFocus || "Mismo eje que la eco",
        labels: allLabels.filter((l) => l.side !== "us"),
        color: [8, 145, 178] as [number, number, number],
      },
    ];

    slots.forEach((slot, i) => {
      const x = marginX + i * (imgW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, imgW, imgH, 1.2, 1.2, "FD");
      drawContained(doc, slot.url, x + 1.2, y + 1.2, imgW - 2.4, imgH - 2.4);
      drawLabelChips(doc, slot.labels, x, y, imgW, imgH, factor, slot.color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      doc.setTextColor(slot.color[0], slot.color[1], slot.color[2]);
      doc.text(slot.badge, x, y + imgH + 3.2 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(51, 65, 85);
      const cap = doc
        .splitTextToSize(sanitizePdfText(slot.caption), imgW)
        .slice(0, 2);
      doc.text(cap, x, y + imgH + 6 * factor);
    });
    y += imgH + 12 * factor;
  } else {
    // Fallback single/dual 3D without US
    const panels = focal?.imageUrl ? [focal] : validFallback.slice(0, 2);
    const n = Math.max(1, panels.length);
    const imgW = (contentWidth - gap * (n - 1)) / n;
    const imgH = Math.min(72 * factor, imgW * 0.75);
    panels.forEach((p, i) => {
      const x = marginX + i * (imgW + gap);
      drawContained(doc, p.imageUrl!, x, y, imgW, imgH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      doc.setTextColor(8, 145, 178);
      doc.text(`Panel ${p.panelLetter || String.fromCharCode(65 + i)}`, x, y + imgH + 3 * factor);
    });
    y += imgH + 12 * factor;
  }

  const summary = sanitizePdfText(data.planeSummary || "");
  if (summary && y < pageBottom - 16 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Sintesis del plano", marginX, y);
    y += 3.6 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3 * factor);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(summary, contentWidth).slice(0, 5);
    doc.text(lines, marginX, y);
    y += lines.length * 3.2 * factor + 2.5 * factor;
  }

  const crossed = (data.structuresCrossed || []).filter(Boolean);
  if (crossed.length && y < pageBottom - 10 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Estructuras cruzadas por el plano", marginX, y);
    y += 3.6 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3 * factor);
    doc.setTextColor(30, 41, 59);
    const crossedLines = doc
      .splitTextToSize(sanitizePdfText(crossed.join(" · ")), contentWidth)
      .slice(0, Math.max(2, Math.floor((pageBottom - y) / (3.2 * factor))));
    doc.text(crossedLines, marginX, y);
  }
}
