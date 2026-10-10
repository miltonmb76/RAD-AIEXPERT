import { UsPlaneSimulatorData } from "../types";
import { buildUsPlaneBridgeLabels, pickBridgeAnatomyPanel } from "../lib/usPlaneBridge";
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

/**
 * One-page PDF annex: US↔3D bridge (eco real | anatomía) + detail panels if room.
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
  if (!data?.panels?.length && !data?.realUsImage?.url) return;
  const valid = (data.panels || []).filter((p) => p?.imageUrl);
  const realUs = data.realUsImage?.url ? data.realUsImage : null;
  const anatomy = pickBridgeAnatomyPanel(data);
  if (!valid.length && !realUs) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 12 * factor;

  doc.addPage();
  let y = 20 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    realUs
      ? "ANEXO: CORTE ECO ↔ ANATOMÍA (BRIDGE US–3D)"
      : "ANEXO: SIMULADOR DE PLANO ECOGRÁFICO 3D",
    marginX,
    y
  );
  y += 4.2 * factor;

  doc.setDrawColor(8, 145, 178);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4.5 * factor;

  const figTitle =
    data.figureTitle ||
    (realUs
      ? "FIGURA. ECO REAL Y PLANO ANATÓMICO 3D"
      : "FIGURA. PLANO DE ADQUISICIÓN ECOGRÁFICA 3D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2 * factor);
  const titleLines = doc
    .splitTextToSize(sanitizePdfText(figTitle), contentWidth - 10 * factor)
    .slice(0, 2);
  const bannerH = Math.max(7 * factor, titleLines.length * 3.6 * factor + 3 * factor);
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(165, 243, 252);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.5, 1.5, "FD");
  doc.setFillColor(8, 145, 178);
  doc.rect(marginX, y, 2.4 * factor, bannerH, "F");
  doc.setTextColor(30, 41, 59);
  let ty = y + 4 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 5.5 * factor, ty);
    ty += 3.6 * factor;
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
    doc.setFontSize(7.8 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(meta).slice(0, 140), marginX, y);
    y += 4.5 * factor;
  }

  const gap = 3.5 * factor;
  const labels =
    data.bridgeLabels?.length
      ? data.bridgeLabels
      : buildUsPlaneBridgeLabels(data, realUs);

  // Bridge row: eco | 3D (preferred when real US present)
  if (realUs && anatomy?.imageUrl) {
    const n = 2;
    const imgW = (contentWidth - gap) / n;
    const imgH = Math.min(68 * factor, imgW * 0.78);
    const slots = [
      {
        url: realUs.url,
        badge: "ECO REAL",
        caption: realUs.caption || realUs.label || "Captura del estudio",
      },
      {
        url: anatomy.imageUrl,
        badge: `ANATOMÍA 3D · ${anatomy.panelLetter || "A"}`,
        caption: anatomy.panelTitle || anatomy.anatomicalFocus || "Plano 3D",
      },
    ];
    slots.forEach((slot, i) => {
      const x = marginX + i * (imgW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, imgW, imgH, 1.2, 1.2, "FD");
      drawContained(doc, slot.url, x + 1.2, y + 1.2, imgW - 2.4, imgH - 2.4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(i === 0 ? 5 : 8, i === 0 ? 150 : 145, i === 0 ? 105 : 178);
      doc.text(slot.badge, x, y + imgH + 3 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(51, 65, 85);
      const cap = doc
        .splitTextToSize(sanitizePdfText(slot.caption), imgW)
        .slice(0, 2);
      doc.text(cap, x, y + imgH + 5.8 * factor);
    });
    y += imgH + 12 * factor;

    if (labels.length && y < pageBottom - 16 * factor) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(8, 145, 178);
      doc.text("Labels del bridge", marginX, y);
      y += 3.5 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(30, 41, 59);
      const labelLine = sanitizePdfText(labels.map((l) => l.text).join("  ·  "));
      const ll = doc.splitTextToSize(labelLine, contentWidth).slice(0, 2);
      doc.text(ll, marginX, y);
      y += ll.length * 3.2 * factor + 3 * factor;
    }

    // Optional second 3D panel if different from anatomy and space remains
    const other = valid.find(
      (p) => p.panelLetter !== anatomy.panelLetter && p.imageUrl
    );
    if (other && y < pageBottom - 40 * factor) {
      const detailW = Math.min(contentWidth * 0.55, 95 * factor);
      const detailH = Math.min(36 * factor, detailW * 0.7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(8, 145, 178);
      doc.text(`Panel ${other.panelLetter} (detalle)`, marginX, y);
      y += 2.5 * factor;
      drawContained(doc, other.imageUrl!, marginX, y, detailW, detailH);
      y += detailH + 4 * factor;
    }
  } else {
    // Fallback: classic 2-panel 3D layout
    const n = Math.min(2, valid.length);
    const imgW = (contentWidth - gap * (n - 1)) / n;
    const imgH = Math.min(72 * factor, imgW * 0.75);
    for (let i = 0; i < n; i++) {
      const p = valid[i];
      const x = marginX + i * (imgW + gap);
      drawContained(doc, p.imageUrl!, x, y, imgW, imgH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(8, 145, 178);
      doc.text(`Panel ${p.panelLetter}`, x, y + imgH + 3.2 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(51, 65, 85);
      const cap = doc
        .splitTextToSize(sanitizePdfText(p.panelTitle || p.anatomicalFocus || ""), imgW)
        .slice(0, 2);
      doc.text(cap, x, y + imgH + 6.2 * factor);
    }
    y += imgH + 14 * factor;
  }

  const summary = sanitizePdfText(data.planeSummary || "");
  if (summary && y < pageBottom - 18 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Síntesis del plano", marginX, y);
    y += 3.8 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4 * factor);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(summary, contentWidth).slice(0, 5);
    doc.text(lines, marginX, y);
    y += lines.length * 3.3 * factor + 2.5 * factor;
  }

  const crossed = (data.structuresCrossed || []).filter(Boolean);
  if (crossed.length && y < pageBottom - 10 * factor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text("Estructuras cruzadas por el plano", marginX, y);
    y += 3.8 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4 * factor);
    doc.setTextColor(30, 41, 59);
    const crossedText = sanitizePdfText(crossed.join(" · "));
    const maxLines = Math.max(2, Math.floor((pageBottom - y) / (3.3 * factor)));
    const crossedLines = doc.splitTextToSize(crossedText, contentWidth).slice(0, maxLines);
    doc.text(crossedLines, marginX, y);
  }
}
