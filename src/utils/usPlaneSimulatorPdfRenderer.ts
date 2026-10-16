import { UsPlaneSimulatorData } from "../types";
import {
  bridgeLabelsToAnnotations,
  buildBridgeClinicalContext,
  pickBridgeFocalPanel,
  seedBridgeArrowAnnotations,
} from "../lib/usPlaneBridge";
import { drawSuiteImageAnnotationsOnPdf } from "./suiteImageAnnotationsPdf";
import { sanitizePdfText } from "./sanitizePdfText";

function imageRatio(doc: any, dataUrl: string): number {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || 4;
    const ih = Number(props?.height) || 3;
    return iw > 0 && ih > 0 ? iw / ih : 4 / 3;
  } catch {
    return 4 / 3;
  }
}

function drawImage(
  doc: any,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  try {
    const fmt = String(dataUrl).includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, fmt, x, y, w, h);
  } catch {
    doc.setFillColor(245, 245, 244);
    doc.rect(x, y, w, h, "F");
  }
}

/**
 * One-page PDF annex — Pack-like aesthetics:
 * header band · text LEFT · US above / 3D below RIGHT with connector.
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
  const bottom = pageHeight - 12 * factor;

  doc.addPage();
  // Clear of running header + gray rule (~15.5)
  let y = 20 * factor;

  // ── Header band (Pack style) ─────────────────────────────────────────────
  const titleLeft = "ANEXO: CORRELACIÓN ECO-ANATÓMICA 3D";
  const metaRaw = [
    data.planeLabelEs || data.acquisitionPlane,
    data.detectedLaterality,
    data.lesionTarget || data.targetStructure,
  ]
    .filter(Boolean)
    .map((s) => sanitizePdfText(String(s)))
    .join("  ·  ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  const titleW = Math.min(doc.getTextWidth(titleLeft) + 2, contentWidth * 0.58);
  const metaMaxW = Math.max(24, contentWidth - titleW - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  const metaLines: string[] = metaRaw
    ? (doc.splitTextToSize(metaRaw, metaMaxW) as string[]).slice(0, 2)
    : [];
  const headerPadY = 3.2 * factor;
  const titleLineH = 4.2 * factor;
  const metaLineH = 3.4 * factor;
  const headerInnerH = Math.max(
    titleLineH,
    metaLines.length ? metaLines.length * metaLineH : 0
  );
  const headerH = headerPadY * 2 + headerInnerH;

  doc.setFillColor(41, 37, 36);
  doc.roundedRect(marginX, y, contentWidth, headerH, 1.5, 1.5, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(marginX, y + headerH, contentWidth, 1.1 * factor, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * factor);
  doc.setTextColor(255, 251, 235);
  doc.text(titleLeft, marginX + 4 * factor, y + headerPadY + titleLineH * 0.78);

  if (metaLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7 * factor);
    doc.setTextColor(253, 230, 138);
    metaLines.forEach((line, i) => {
      doc.text(
        line,
        marginX + contentWidth - 4 * factor,
        y + headerPadY + metaLineH * (i + 0.78),
        { align: "right" }
      );
    });
  }
  y += headerH + 1.1 * factor + 7 * factor;

  // ── Anchor title ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(180, 83, 9);
  doc.text("HALLAZGO / PLANO", marginX, y);
  y += 5.5 * factor;

  const figTitle = sanitizePdfText(
    data.figureTitle ||
      data.lesionTarget ||
      data.targetStructure ||
      "Eco real y corte 3D focal"
  );
  doc.setFont("helvetica", "bold");
  let dxSize = figTitle.length > 90 ? 11.5 : figTitle.length > 60 ? 12.5 : 14;
  doc.setFontSize(dxSize * factor);
  let dxWrapped = doc.splitTextToSize(figTitle, contentWidth) as string[];
  if (dxWrapped.length > 3 && dxSize > 11) {
    dxSize = 11;
    doc.setFontSize(dxSize * factor);
    dxWrapped = doc.splitTextToSize(figTitle, contentWidth) as string[];
  }
  const dxLineH = dxSize * 0.42 * factor + 1.1 * factor;
  doc.setTextColor(28, 25, 23);
  dxWrapped.forEach((line) => {
    doc.text(line, marginX, y);
    y += dxLineH;
  });
  y += 2 * factor;

  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.45);
  doc.line(marginX, y, marginX + 36 * factor, y);
  y += 6 * factor;

  // ── Columns: text LEFT · images RIGHT (US above, 3D below) ───────────────
  const colGap = 9 * factor;
  // Slightly wider text column so wrapped lines are not clipped at the edge
  const imgColW = contentWidth * 0.4;
  const textColW = contentWidth - imgColW - colGap;
  const textX = marginX;
  const imgX = marginX + textColW + colGap;
  const colsTop = y;
  const usableBottom = bottom - 14 * factor;
  const textWrapW = Math.max(40 * factor, textColW - 2.5 * factor);

  const annotations = Array.isArray(data.imageAnnotations)
    ? data.imageAnnotations
    : seedBridgeArrowAnnotations({
        lesionTarget: data.lesionTarget || data.targetStructure,
        realUs,
        structuresCrossed: data.structuresCrossed,
        existing: bridgeLabelsToAnnotations(data.bridgeLabels),
      });

  type ImgSlot = {
    url: string;
    badge: string;
    caption: string;
    letter: string;
  };
  const imgSlots: ImgSlot[] = [];
  if (realUs?.url) {
    imgSlots.push({
      url: realUs.url,
      badge: "ECO REAL (US)",
      caption: realUs.caption || realUs.label || "Captura del estudio",
      letter: "US",
    });
  }
  if (focal?.imageUrl) {
    // Prefer short panel titles for captions — lesionTarget can be a long prose line
    const shortCgiCap =
      focal.panelTitle ||
      focal.anatomicalFocus ||
      data.targetStructure ||
      "Mismo eje que la eco";
    imgSlots.push({
      url: focal.imageUrl,
      badge: "RECONSTRUCCIÓN 3D",
      caption: String(shortCgiCap),
      letter: focal.panelLetter || "A",
    });
  } else if (!realUs && validFallback[0]?.imageUrl) {
    imgSlots.push({
      url: validFallback[0].imageUrl!,
      badge: "CORTE 3D",
      caption: validFallback[0].panelTitle || "Panel",
      letter: validFallback[0].panelLetter || "A",
    });
  }

  const framePad = 1.2 * factor;
  const captionH = 5 * factor;
  const badgeH = 3.6 * factor;
  // Room for stem + chevron + label (no overlap)
  const connectorH = imgSlots.length === 2 ? 13.5 * factor : 0;
  const ratios = imgSlots.map((s) => imageRatio(doc, s.url));
  const maxInnerW = imgColW - framePad * 2;
  const naturalInnerHs = ratios.map((r) => maxInnerW / r);
  const chrome =
    imgSlots.length * (framePad * 2 + captionH + badgeH) +
    connectorH +
    2 * factor * Math.max(0, imgSlots.length - 1);
  const naturalTotal = naturalInnerHs.reduce((a, b) => a + b, 0) + chrome;
  const maxImgBlock = Math.max(40 * factor, usableBottom - colsTop);

  let innerW = maxInnerW;
  if (naturalTotal > maxImgBlock && naturalTotal > 0) {
    const availForImgs = Math.max(20 * factor, maxImgBlock - chrome);
    const naturalImgs = naturalInnerHs.reduce((a, b) => a + b, 0) || 1;
    innerW = maxInnerW * (availForImgs / naturalImgs);
  }

  let imgY = colsTop;
  imgSlots.forEach((slot, i) => {
    const drawW = innerW;
    const drawH = drawW / ratios[i];
    const boxW = drawW + framePad * 2;
    const boxH = drawH + framePad * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(180, 83, 9);
    doc.text(slot.badge, imgX, imgY + 2.4 * factor);
    imgY += badgeH;

    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(214, 211, 209);
    doc.setLineWidth(0.3);
    doc.roundedRect(imgX, imgY, boxW, boxH, 1.2, 1.2, "FD");
    drawImage(doc, slot.url, imgX + framePad, imgY + framePad, drawW, drawH);
    drawSuiteImageAnnotationsOnPdf(
      doc,
      annotations,
      slot.letter,
      imgX + framePad,
      imgY + framePad,
      drawW,
      drawH,
      factor
    );
    if (slot.letter !== "A" && i === imgSlots.length - 1 && slot.badge.includes("3D")) {
      drawSuiteImageAnnotationsOnPdf(
        doc,
        annotations,
        "A",
        imgX + framePad,
        imgY + framePad,
        drawW,
        drawH,
        factor
      );
    }

    imgY += boxH + 1.2 * factor;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(100, 116, 139);
    const cap = sanitizePdfText(slot.caption);
    // Prefer a short caption; long lesion prose wraps up to 2 lines with ellipsis
    const capLines = (doc.splitTextToSize(cap, Math.max(30 * factor, boxW)) as string[]).slice(
      0,
      2
    );
    if (capLines.length) {
      const more =
        (doc.splitTextToSize(cap, Math.max(30 * factor, boxW)) as string[]).length >
        capLines.length;
      capLines.forEach((line, li) => {
        const t =
          more && li === capLines.length - 1 && line.length > 4
            ? `${line.replace(/\s+\S*$/, "").trimEnd()}…`
            : line;
        doc.text(t, imgX, imgY + 2 * factor + li * 3.2 * factor);
      });
    }
    imgY += captionH + (capLines.length > 1 ? 3.2 * factor : 0);

    // Connector between US and 3D — elegant stem + open chevron, label below
    if (i === 0 && imgSlots.length === 2) {
      const midX = imgX + boxW / 2;
      const stemTop = imgY + 1.2 * factor;
      const stemBot = imgY + 4.2 * factor;
      const chevronTipY = stemBot + 2.6 * factor;
      const chevronHalfW = 2.2 * factor;
      const chevronBaseY = stemBot + 0.35 * factor;
      const labelY = chevronTipY + 3.6 * factor;
      const stemOutTop = labelY + 1.6 * factor;
      const stemOutBot = imgY + connectorH - 0.8 * factor;

      doc.setDrawColor(180, 83, 9); // amber-700
      doc.setLineWidth(0.45);
      doc.setLineCap(1); // round
      // Upper stem
      doc.line(midX, stemTop, midX, stemBot);
      // Open chevron (two strokes) — refined, not a filled triangle
      doc.setLineWidth(0.55);
      doc.line(midX - chevronHalfW, chevronBaseY, midX, chevronTipY);
      doc.line(midX + chevronHalfW, chevronBaseY, midX, chevronTipY);
      // Soft accent tip (tiny filled diamond at point)
      doc.setFillColor(217, 119, 6);
      const tip = 0.55 * factor;
      doc.triangle(
        midX,
        chevronTipY + tip * 0.35,
        midX - tip,
        chevronTipY - tip * 0.55,
        midX + tip,
        chevronTipY - tip * 0.55,
        "F"
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2 * factor);
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text("mismo hallazgo · mismo plano", midX, labelY, { align: "center" });

      // Short trailing stem under the label
      doc.setDrawColor(180, 83, 9);
      doc.setLineWidth(0.4);
      if (stemOutBot > stemOutTop + 0.8 * factor) {
        doc.line(midX, stemOutTop, midX, stemOutBot);
      }
      imgY += connectorH;
    }
  });

  // ── Left text column — wrap inside column; use height down to image bottom ─
  let textY = colsTop;
  const leftTitleSize = 8.5 * factor;
  const leftBodySize = 9.5 * factor;
  const leftLineH = 4.15 * factor;
  const leftSectionGap = 5.5 * factor;
  // Prefer aligning with the image stack; never go past page usable bottom
  const textFloor = Math.min(usableBottom, Math.max(colsTop + 40 * factor, imgY));

  const ellipsisLast = (lines: string[], truncated: boolean) => {
    if (!truncated || !lines.length) return lines;
    const last = lines[lines.length - 1] || "";
    const clipped =
      last.length > 4 ? `${last.replace(/\s+\S*$/, "").trimEnd()}…` : `${last}…`;
    return [...lines.slice(0, -1), clipped];
  };

  const roomLeft = () => textFloor - textY;

  const writeSectionTitle = (title: string) => {
    if (roomLeft() < 10 * factor) return false;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(leftTitleSize);
    doc.setTextColor(180, 83, 9);
    doc.text(title, textX, textY);
    textY += 5 * factor;
    return true;
  };

  /** Paragraph wrapped to full text column width (no right-edge clip). */
  const writeParagraph = (body: string, maxLines: number) => {
    const clean = sanitizePdfText(body || "").trim();
    if (!clean) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(leftBodySize);
    doc.setTextColor(41, 37, 36);
    const all = doc.splitTextToSize(clean, textWrapW) as string[];
    const fitBySpace = Math.max(1, Math.floor(roomLeft() / leftLineH));
    const n = Math.min(maxLines, fitBySpace, all.length);
    const lines = ellipsisLast(all.slice(0, n), all.length > n);
    lines.forEach((line) => {
      doc.text(line, textX, textY);
      textY += leftLineH;
    });
    textY += leftSectionGap;
  };

  /** Numbered list: each item wraps fully; never hard-cut mid-item by a global line cap. */
  const writeNumberedList = (title: string, items: string[], maxItems: number) => {
    const list = items.map((s) => sanitizePdfText(String(s || "")).trim()).filter(Boolean);
    if (!list.length) return;
    if (!writeSectionTitle(title)) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(leftBodySize);
    doc.setTextColor(41, 37, 36);
    const shown = list.slice(0, maxItems);
    shown.forEach((item, i) => {
      if (roomLeft() < leftLineH * 1.2) return;
      const prefix = `${i + 1}. `;
      const wrapped = doc.splitTextToSize(`${prefix}${item}`, textWrapW) as string[];
      const fit = Math.max(1, Math.floor(roomLeft() / leftLineH));
      const lines = ellipsisLast(wrapped.slice(0, fit), wrapped.length > fit);
      lines.forEach((line) => {
        doc.text(line, textX, textY);
        textY += leftLineH;
      });
      textY += 1.2 * factor;
    });
    if (list.length > shown.length && roomLeft() > leftLineH) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(120, 113, 108);
      doc.text(`(+${list.length - shown.length} más)`, textX, textY);
      textY += leftLineH;
    }
    textY += leftSectionGap - 1.2 * factor;
  };

  // Mini-ficha — values wrap inside the card (pad right so glyphs aren't clipped)
  const sheetRows = [
    data.planeLabelEs || data.acquisitionPlane
      ? { label: "Plano", value: String(data.planeLabelEs || data.acquisitionPlane) }
      : null,
    data.detectedLaterality
      ? { label: "Lado", value: String(data.detectedLaterality) }
      : null,
    data.lesionTarget || data.targetStructure
      ? {
          label: "Foco",
          value: String(data.lesionTarget || data.targetStructure),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (sheetRows.length && writeSectionTitle("MINI-FICHA DEL PLANO")) {
    textY -= 1.5 * factor; // tighter under section title before card
    const labelW = 18 * factor;
    const boxPadL = 3.5 * factor;
    const boxPadR = 3.5 * factor;
    const valueW = Math.max(22 * factor, textColW - boxPadL - labelW - boxPadR);
    const sheetRowH = 4.4 * factor;
    const sheetFont = 8.2 * factor;
    const maxValueLines = 4;
    type SheetRow = { label: string; valueLines: string[] };
    const built: SheetRow[] = sheetRows.map((r) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(sheetFont);
      const all = doc.splitTextToSize(sanitizePdfText(r.value), valueW) as string[];
      return {
        label: sanitizePdfText(r.label),
        valueLines: ellipsisLast(
          all.slice(0, maxValueLines),
          all.length > maxValueLines
        ),
      };
    });
    const sheetH =
      built.reduce((a, r) => a + Math.max(1, r.valueLines.length) * sheetRowH, 0) +
      6.5 * factor;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.3);
    doc.roundedRect(textX, textY, textColW, sheetH, 1.5, 1.5, "FD");
    let sy = textY + 5.2 * factor;
    built.forEach((r) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(sheetFont);
      doc.setTextColor(120, 113, 108);
      doc.text(`${r.label}:`, textX + boxPadL, sy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(41, 37, 36);
      r.valueLines.forEach((line, li) => {
        doc.text(line, textX + boxPadL + labelW, sy);
        if (li < r.valueLines.length - 1) sy += sheetRowH;
      });
      sy += sheetRowH;
    });
    textY += sheetH + leftSectionGap;
  }

  if (data.planeSummary && writeSectionTitle("SÍNTESIS DEL PLANO")) {
    writeParagraph(data.planeSummary, 8);
  }

  const crossed = (data.structuresCrossed || []).filter(Boolean);
  if (crossed.length) {
    writeNumberedList("ESTRUCTURAS CRUZADAS", crossed.map(String), 6);
  }

  const keys = (data.keyPoints || []).filter(Boolean);
  if (keys.length) {
    writeNumberedList("PUNTOS CLAVE", keys.map(String), 6);
  }

  const context =
    data.clinicalContextLines?.length
      ? data.clinicalContextLines
      : buildBridgeClinicalContext({
          plane: data,
          lesionTarget: data.lesionTarget,
        });
  if (context.length && roomLeft() > 16 * factor) {
    if (writeSectionTitle("NOTA CLÍNICA")) {
      writeParagraph(context.slice(0, 3).join("\n\n"), 5);
    }
  }

  // Footer note
  const footY = Math.max(imgY, textY) + 4 * factor;
  if (footY < bottom - 4 * factor) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5 * factor);
    doc.setTextColor(120, 113, 108);
    doc.text(
      "Dos representaciones del mismo hallazgo en el mismo plano de adquisición.",
      marginX,
      Math.min(footY, bottom - 2 * factor)
    );
  }
}
