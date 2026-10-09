import type { jsPDF } from "jspdf";
import type { DominantLesionCardData } from "../lib/dominantLesionCard";
import { sanitizePdfText } from "./sanitizePdfText";

function wrapText(doc: jsPDF, text: string, maxW: number, maxLines: number): string[] {
  const lines = doc.splitTextToSize(sanitizePdfText(text), maxW) as string[];
  return lines.slice(0, maxLines);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function drawContainedImage(
  doc: jsPDF,
  dataUrl: string,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.min(boxW / iw, boxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;
  const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
  doc.addImage(dataUrl, fmt, dx, dy, dw, dh);
}

async function drawImagePanel(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  caption: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  emptyLabel: string
) {
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  const pad = 2.5;
  if (dataUrl) {
    const img = await loadImage(dataUrl);
    if (img) {
      try {
        drawContainedImage(doc, dataUrl, img, x + pad, y + pad, w - pad * 2, h - pad * 2 - 6);
      } catch {
        /* ignore */
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(226, 232, 240);
      doc.text(sanitizePdfText(caption || "").slice(0, 55), x + 3, y + h - 2.5);
      return;
    }
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(emptyLabel, x + w / 2, y + h / 2, { align: "center" });
}

/**
 * One-page elegant annex with single or dual image layouts.
 */
export async function renderDominantLesionCardAnnexToPDF(
  doc: jsPDF,
  data: DominantLesionCardData,
  opts?: {
    clinicName?: string;
    imageDataUrl?: string | null;
    imageCaption?: string | null;
    imageBDataUrl?: string | null;
    imageBCaption?: string | null;
    focal3dDataUrl?: string | null;
    focal3dCaption?: string | null;
  }
): Promise<void> {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const layout = data.imageLayout || "single";

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  const headH = 28;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, headH, "F");
  doc.setFillColor(190, 18, 60);
  doc.rect(0, headH - 1.6, pageW, 1.6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(251, 113, 133);
  doc.text("LESIÓN DOMINANTE", margin, 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  const titleLines = wrapText(doc, data.lesionLabel, contentW - 52, 2);
  let ty = 15.5;
  titleLines.forEach((line) => {
    doc.text(line, margin, ty);
    ty += 5.2;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const meta = [data.site, data.laterality, data.studyRegion].filter(Boolean).join("  ·  ");
  doc.text(sanitizePdfText(meta).slice(0, 90), margin, headH - 4);

  if (opts?.clinicName) {
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(sanitizePdfText(opts.clinicName).slice(0, 40), pageW - margin, 9, { align: "right" });
  }

  const cat = [data.categorySystem, data.categoryValue].filter(Boolean).join(" ");
  if (cat) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const catW = Math.min(50, Math.max(28, doc.getTextWidth(cat) + 10));
    const catX = pageW - margin - catW;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(catX, 10, catW, 12, 2, 2, "F");
    doc.setTextColor(159, 18, 57);
    doc.text(sanitizePdfText(cat), catX + catW / 2, 17.8, { align: "center" });
  }

  const stageTop = headH + 6;
  const phraseH = 30;
  const footerNoteY = pageH - 8;
  const stageBottom = footerNoteY - phraseH - 6;
  const stageH = stageBottom - stageTop;

  const gap = 5;
  const mediaW = contentW * (layout === "single" ? 0.56 : 0.58);
  const sideW = contentW - mediaW - gap;
  const mediaX = margin;
  const sideX = margin + mediaW + gap;

  if (layout === "mmg_us") {
    const cellW = (mediaW - 3) / 2;
    await drawImagePanel(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || "MMG",
      mediaX,
      stageTop,
      cellW,
      stageH,
      "Sin MMG"
    );
    await drawImagePanel(
      doc,
      opts?.imageBDataUrl,
      opts?.imageBCaption || "US",
      mediaX + cellW + 3,
      stageTop,
      cellW,
      stageH,
      "Sin US"
    );
  } else if (layout === "clinical_3d") {
    const topH = stageH * 0.55;
    const botH = stageH - topH - 3;
    await drawImagePanel(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || "Imagen clínica",
      mediaX,
      stageTop,
      mediaW,
      topH,
      "Sin imagen clínica"
    );
    await drawImagePanel(
      doc,
      opts?.focal3dDataUrl,
      opts?.focal3dCaption || "Corte 3D",
      mediaX,
      stageTop + topH + 3,
      mediaW,
      botH,
      "Sin corte 3D"
    );
  } else {
    await drawImagePanel(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || (data.figureRef ? `Figura ${data.figureRef}` : "Imagen clínica"),
      mediaX,
      stageTop,
      mediaW,
      stageH,
      "Sin imagen asociada"
    );
  }

  // Side facts
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(sideX, stageTop, sideW, stageH, 3, 3, "FD");

  let y = stageTop + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("TAMAÑO", sideX + 5, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.sizeSummary || "—"), sideX + 5, y);
  y += 7;

  if (data.measurements.length) {
    const cellW = (sideW - 14) / 2;
    let cx = sideX + 5;
    let row = 0;
    data.measurements.slice(0, 4).forEach((m, i) => {
      if (i > 0 && i % 2 === 0) {
        cx = sideX + 5;
        row += 1;
      }
      const cy = y + row * 11.5;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cx, cy, cellW - 2, 10, 1.4, 1.4, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(sanitizePdfText(m.label).toUpperCase(), cx + 2, cy + 3.4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(sanitizePdfText(m.value), cx + 2, cy + 7.8);
      cx += cellW;
    });
    y += Math.ceil(Math.min(4, data.measurements.length) / 2) * 11.5 + 4;
  }

  if (data.categoryRationale) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("FUNDAMENTO", sideX + 5, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    wrapText(doc, data.categoryRationale, sideW - 10, 3).forEach((line) => {
      doc.text(line, sideX + 5, y);
      y += 3.5;
    });
    y += 3;
  }

  if (data.keyDescriptors?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("DESCRIPTORES", sideX + 5, y);
    y += 5;
    data.keyDescriptors.slice(0, 5).forEach((d) => {
      if (y > stageTop + stageH - 8) return;
      const label = sanitizePdfText(d).slice(0, 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const tw = Math.min(sideW - 12, doc.getTextWidth(label) + 6);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(sideX + 5, y - 3, tw, 6, 1.4, 1.4, "F");
      doc.setTextColor(51, 65, 85);
      doc.text(label, sideX + 7.5, y + 0.8);
      y += 7.5;
    });
  }

  const phraseY = stageBottom + 3;
  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(margin, phraseY, contentW, phraseH, 2.5, 2.5, "FD");
  doc.setFillColor(225, 29, 72);
  doc.rect(margin, phraseY, 2.2, phraseH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(190, 18, 60);
  doc.text("PARA EL CLÍNICO", margin + 7, phraseY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  wrapText(doc, data.clinicianPhrase, contentW - 16, 3).forEach((line, i) => {
    doc.text(line, margin + 7, phraseY + 13 + i * 4.8);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Ficha orientativa de la lesión dominante · no sustituye el informe completo",
    margin,
    footerNoteY
  );
}
