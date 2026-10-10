import { UsPlaneSimulatorData } from "../types";
import {
  bridgeLabelsToAnnotations,
  buildBridgeClinicalContext,
  pickBridgeFocalPanel,
  seedBridgeArrowAnnotations,
} from "../lib/usPlaneBridge";
import { drawSuiteImageAnnotationsOnPdf } from "./suiteImageAnnotationsPdf";
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
 * One-page PDF: ECO REAL | CORTE 3D FOCAL with suite-style arrows + dense footer.
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
  const pageBottom = pageHeight - 11 * factor;

  doc.addPage();
  let y = 16 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CORRELACION ECO-ANATOMICA 3D", marginX, y);
  y += 3.8 * factor;

  doc.setDrawColor(8, 145, 178);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 3.8 * factor;

  const figTitle = sanitizePdfText(
    data.figureTitle || "FIGURA. ECO REAL Y CORTE 3D FOCAL"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  const titleLines = doc.splitTextToSize(figTitle, contentWidth - 10 * factor).slice(0, 2);
  const bannerH = Math.max(6.5 * factor, titleLines.length * 3.4 * factor + 2.8 * factor);
  doc.setFillColor(236, 254, 255);
  doc.setDrawColor(165, 243, 252);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.5, 1.5, "FD");
  doc.setFillColor(8, 145, 178);
  doc.rect(marginX, y, 2.4 * factor, bannerH, "F");
  doc.setTextColor(30, 41, 59);
  let ty = y + 3.8 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 5.5 * factor, ty);
    ty += 3.4 * factor;
  });
  y += bannerH + 2.8 * factor;

  const meta = [
    data.planeLabelEs ? `Plano: ${data.planeLabelEs}` : "",
    data.detectedLaterality ? `Lado: ${data.detectedLaterality}` : "",
    data.lesionTarget
      ? `Lesion: ${data.lesionTarget}`
      : data.targetStructure
        ? `Estructura: ${data.targetStructure}`
        : "",
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(meta).slice(0, 150), marginX, y);
    y += 4 * factor;
  }

  const gap = 3.2 * factor;
  const annotations =
    data.imageAnnotations?.length
      ? data.imageAnnotations
      : seedBridgeArrowAnnotations({
          lesionTarget: data.lesionTarget || data.targetStructure,
          realUs,
          structuresCrossed: data.structuresCrossed,
          existing: bridgeLabelsToAnnotations(data.bridgeLabels),
        });

  if (realUs && focal?.imageUrl) {
    const imgW = (contentWidth - gap) / 2;
    const imgH = Math.min(70 * factor, imgW * 0.78);
    const slots = [
      {
        url: realUs.url,
        badge: "ECO REAL",
        caption: realUs.caption || realUs.label || "Captura del estudio",
        letter: "US",
        color: [16, 185, 129] as [number, number, number],
      },
      {
        url: focal.imageUrl!,
        badge: "CORTE 3D FOCAL",
        caption:
          focal.panelTitle ||
          data.lesionTarget ||
          focal.anatomicalFocus ||
          "Mismo eje / estructura lesionada",
        letter: focal.panelLetter || "A",
        color: [8, 145, 178] as [number, number, number],
      },
    ];

    slots.forEach((slot, i) => {
      const x = marginX + i * (imgW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, imgW, imgH, 1.2, 1.2, "FD");
      drawContained(doc, slot.url, x + 1, y + 1, imgW - 2, imgH - 2);
      drawSuiteImageAnnotationsOnPdf(
        doc,
        annotations,
        slot.letter,
        x + 1,
        y + 1,
        imgW - 2,
        imgH - 2,
        factor
      );
      // Also try "A" if focal letter differs
      if (slot.letter !== "A" && i === 1) {
        drawSuiteImageAnnotationsOnPdf(doc, annotations, "A", x + 1, y + 1, imgW - 2, imgH - 2, factor);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8 * factor);
      doc.setTextColor(slot.color[0], slot.color[1], slot.color[2]);
      doc.text(slot.badge, x, y + imgH + 3 * factor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3 * factor);
      doc.setTextColor(51, 65, 85);
      const cap = doc
        .splitTextToSize(sanitizePdfText(slot.caption), imgW)
        .slice(0, 2);
      doc.text(cap, x, y + imgH + 5.6 * factor);
    });
    y += imgH + 11 * factor;
  } else {
    const panels = focal?.imageUrl ? [focal] : validFallback.slice(0, 2);
    const n = Math.max(1, panels.length);
    const imgW = (contentWidth - gap * (n - 1)) / n;
    const imgH = Math.min(68 * factor, imgW * 0.75);
    panels.forEach((p, i) => {
      const x = marginX + i * (imgW + gap);
      drawContained(doc, p.imageUrl!, x, y, imgW, imgH);
      drawSuiteImageAnnotationsOnPdf(
        doc,
        annotations,
        p.panelLetter || "A",
        x,
        y,
        imgW,
        imgH,
        factor
      );
    });
    y += imgH + 10 * factor;
  }

  const writeSection = (title: string, body: string, maxLines: number) => {
    if (!body.trim() || y > pageBottom - 12 * factor) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8 * factor);
    doc.setTextColor(8, 145, 178);
    doc.text(title, marginX, y);
    y += 3.4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2 * factor);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(sanitizePdfText(body), contentWidth).slice(0, maxLines);
    doc.text(lines, marginX, y);
    y += lines.length * 3.15 * factor + 2.4 * factor;
  };

  if (data.lesionTarget) {
    writeSection(
      "Estructura lesionada (objetivo del corte)",
      data.lesionTarget,
      2
    );
  }

  writeSection("Sintesis del plano", data.planeSummary || "", 5);

  const crossed = (data.structuresCrossed || []).filter(Boolean);
  if (crossed.length) {
    writeSection("Estructuras cruzadas por el plano", crossed.join(" · "), 3);
  }

  const keys = (data.keyPoints || []).filter(Boolean);
  if (keys.length) {
    writeSection("Puntos clave", keys.map((k, i) => `${i + 1}. ${k}`).join("  "), 4);
  }

  const context =
    data.clinicalContextLines?.length
      ? data.clinicalContextLines
      : buildBridgeClinicalContext({
          plane: data,
          lesionTarget: data.lesionTarget,
        });
  if (context.length && y < pageBottom - 14 * factor) {
    writeSection(
      "Contexto clinico (informe / scorecard / rotulacion)",
      context.join(" | "),
      Math.max(3, Math.floor((pageBottom - y) / (3.15 * factor)))
    );
  }
}
