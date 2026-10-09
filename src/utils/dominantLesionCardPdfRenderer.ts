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

/**
 * One-page elegant annex: hero image + clinical summary + clinician phrase.
 */
export async function renderDominantLesionCardAnnexToPDF(
  doc: jsPDF,
  data: DominantLesionCardData,
  opts?: {
    clinicName?: string;
    imageDataUrl?: string | null;
    imageCaption?: string | null;
    focal3dDataUrl?: string | null;
  }
): Promise<void> {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;

  // Soft page wash
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  // Dark masthead band
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
    const catY = 10;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(catX, catY, catW, 12, 2, 2, "F");
    doc.setTextColor(159, 18, 57);
    doc.text(sanitizePdfText(cat), catX + catW / 2, catY + 7.8, { align: "center" });
  }

  // Main stage
  const stageTop = headH + 6;
  const phraseH = 32;
  const footerNoteY = pageH - 8;
  const stageBottom = footerNoteY - phraseH - 6;
  const stageH = stageBottom - stageTop;

  const gap = 6;
  const imgW = contentW * 0.56;
  const sideW = contentW - imgW - gap;
  const imgX = margin;
  const sideX = margin + imgW + gap;

  // Image panel
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(imgX, stageTop, imgW, stageH, 3, 3, "F");

  const imgPad = 3;
  const clinicalImg = opts?.imageDataUrl ? await loadImage(opts.imageDataUrl) : null;
  if (clinicalImg && opts?.imageDataUrl) {
    try {
      drawContainedImage(
        doc,
        opts.imageDataUrl,
        clinicalImg,
        imgX + imgPad,
        stageTop + imgPad,
        imgW - imgPad * 2,
        stageH - imgPad * 2 - 8
      );
    } catch {
      /* fall through */
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(226, 232, 240);
    const cap = opts.imageCaption || (data.figureRef ? `Figura ${data.figureRef}` : "Imagen clínica");
    doc.text(sanitizePdfText(cap).slice(0, 70), imgX + 4, stageTop + stageH - 3);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin imagen asociada", imgX + imgW / 2, stageTop + stageH / 2, { align: "center" });
  }

  // Side panel (white card)
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
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.sizeSummary || "—"), sideX + 5, y);
  y += 8;

  if (data.measurements.length) {
    const cellW = (sideW - 14) / 2;
    let cx = sideX + 5;
    let row = 0;
    data.measurements.slice(0, 4).forEach((m, i) => {
      if (i > 0 && i % 2 === 0) {
        cx = sideX + 5;
        row += 1;
      }
      const cy = y + row * 12;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(241, 245, 249);
      doc.roundedRect(cx, cy, cellW - 2, 10.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(sanitizePdfText(m.label).toUpperCase(), cx + 2.2, cy + 3.6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(sanitizePdfText(m.value), cx + 2.2, cy + 8.2);
      cx += cellW;
    });
    y += Math.ceil(Math.min(4, data.measurements.length) / 2) * 12 + 4;
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
      y += 3.6;
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
      if (y > stageTop + stageH - 28) return;
      const label = sanitizePdfText(d).slice(0, 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const tw = doc.getTextWidth(label) + 6;
      if (sideX + 5 + tw > sideX + sideW - 4) return;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(sideX + 5, y - 3.2, tw, 6.5, 1.5, 1.5, "F");
      doc.setTextColor(51, 65, 85);
      doc.text(label, sideX + 8, y);
      y += 8;
    });
  }

  // Optional 3D thumb in remaining side space
  if (opts?.focal3dDataUrl) {
    const thumbMaxH = Math.max(22, stageTop + stageH - y - 6);
    if (thumbMaxH > 24) {
      const focalImg = await loadImage(opts.focal3dDataUrl);
      if (focalImg) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(13, 148, 136);
        doc.text("CORTE 3D", sideX + 5, y + 2);
        try {
          drawContainedImage(
            doc,
            opts.focal3dDataUrl,
            focalImg,
            sideX + 5,
            y + 4,
            sideW - 10,
            thumbMaxH - 6
          );
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Full-width clinician phrase band
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
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  wrapText(doc, data.clinicianPhrase, contentW - 16, 3).forEach((line, i) => {
    doc.text(line, margin + 7, phraseY + 13 + i * 5);
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
