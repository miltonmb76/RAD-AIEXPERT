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

/**
 * One-page annex: dominant lesion card (measures, category, image, 3D thumb, clinician phrase).
 */
export async function renderDominantLesionCardAnnexToPDF(
  doc: jsPDF,
  data: DominantLesionCardData,
  opts?: {
    clinicName?: string;
    imageDataUrl?: string | null;
    focal3dDataUrl?: string | null;
  }
): Promise<void> {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: FICHA DE LESIÓN DOMINANTE", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const sub = [data.studyRegion, data.laterality].filter(Boolean).join(" · ");
  if (sub) doc.text(sanitizePdfText(sub), margin, 21);
  if (opts?.clinicName) {
    doc.text(sanitizePdfText(opts.clinicName).slice(0, 50), pageW - margin, 16, { align: "right" });
  }

  // Title row + category badge
  let y = 28;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 16, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.lesionLabel).slice(0, 70), margin + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(sanitizePdfText(data.site).slice(0, 90), margin + 4, y + 12.5);

  const cat = [data.categorySystem, data.categoryValue].filter(Boolean).join(" ");
  if (cat) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const catW = Math.min(48, doc.getTextWidth(cat) + 8);
    const catX = margin + contentW - catW - 3;
    doc.setFillColor(255, 228, 230);
    doc.setDrawColor(251, 113, 133);
    doc.roundedRect(catX, y + 3.5, catW, 9, 1.5, 1.5, "FD");
    doc.setTextColor(159, 18, 57);
    doc.text(sanitizePdfText(cat), catX + catW / 2, y + 9.5, { align: "center" });
  }
  y += 20;

  const colGap = 8;
  const leftW = contentW * 0.48;
  const rightW = contentW - leftW - colGap;
  const leftX = margin;
  const rightX = margin + leftW + colGap;
  const blockTop = y;
  const blockBottom = pageH - 18;
  const blockH = blockBottom - blockTop;

  // Left column: clinical image + optional 3D
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftX, blockTop, leftW, blockH, 2.5, 2.5, "FD");

  const imgPad = 4;
  let imgAreaH = blockH * (opts?.focal3dDataUrl ? 0.62 : 0.88);
  const imgBoxY = blockTop + imgPad + 4;
  const imgBoxW = leftW - imgPad * 2;
  const imgBoxH = imgAreaH - 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("IMAGEN US / MMG", leftX + imgPad, blockTop + 5);

  const clinicalImg = opts?.imageDataUrl ? await loadImage(opts.imageDataUrl) : null;
  if (clinicalImg) {
    const iw = clinicalImg.width || 1;
    const ih = clinicalImg.height || 1;
    const scale = Math.min(imgBoxW / iw, imgBoxH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = leftX + imgPad + (imgBoxW - dw) / 2;
    const dy = imgBoxY + (imgBoxH - dh) / 2;
    try {
      const fmt = opts!.imageDataUrl!.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(opts!.imageDataUrl!, fmt, dx, dy, dw, dh);
    } catch {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("No se pudo embeber la imagen", leftX + leftW / 2, imgBoxY + imgBoxH / 2, {
        align: "center",
      });
    }
  } else {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(leftX + imgPad, imgBoxY, imgBoxW, imgBoxH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin imagen vinculada", leftX + leftW / 2, imgBoxY + imgBoxH / 2, { align: "center" });
  }

  if (data.figureRef) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fig. ${data.figureRef}`, leftX + imgPad, imgBoxY + imgBoxH + 4);
  }

  if (opts?.focal3dDataUrl) {
    const thumbY = blockTop + imgAreaH + 2;
    const thumbH = blockH - imgAreaH - 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(13, 148, 136);
    doc.text("CORTE 3D", leftX + imgPad, thumbY + 3);
    const focalImg = await loadImage(opts.focal3dDataUrl);
    if (focalImg) {
      const tw = leftW - imgPad * 2;
      const th = Math.max(18, thumbH - 6);
      const iw = focalImg.width || 1;
      const ih = focalImg.height || 1;
      const scale = Math.min(tw / iw, th / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      try {
        const fmt = opts.focal3dDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(
          opts.focal3dDataUrl,
          fmt,
          leftX + imgPad + (tw - dw) / 2,
          thumbY + 5,
          dw,
          dh
        );
      } catch {
        /* ignore */
      }
    }
  }

  // Right column: measures, category, descriptors, phrase
  let ry = blockTop;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, blockTop, rightW, blockH, 2.5, 2.5, "FD");
  ry += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("MEDIDAS", rightX + 4, ry);
  ry += 5;

  if (data.sizeSummary) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(data.sizeSummary), rightX + 4, ry + 2);
    ry += 8;
  }

  if (data.measurements.length) {
    const cellW = (rightW - 12) / 2;
    let cx = rightX + 4;
    let cy = ry;
    data.measurements.slice(0, 6).forEach((m, i) => {
      if (i > 0 && i % 2 === 0) {
        cx = rightX + 4;
        cy += 12;
      }
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cy, cellW - 2, 10, 1.2, 1.2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(sanitizePdfText(m.label).toUpperCase(), cx + 2, cy + 3.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(m.value), cx + 2, cy + 8);
      cx += cellW;
    });
    ry = cy + 14;
  } else if (!data.sizeSummary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin medidas explícitas en el informe", rightX + 4, ry);
    ry += 6;
  }

  if (data.categoryRationale || cat) {
    ry += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("CATEGORÍA", rightX + 4, ry);
    ry += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const rationale = data.categoryRationale || cat || "";
    wrapText(doc, rationale, rightW - 8, 3).forEach((line) => {
      doc.text(line, rightX + 4, ry);
      ry += 3.6;
    });
    ry += 2;
  }

  if (data.keyDescriptors?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("DESCRIPTORES", rightX + 4, ry);
    ry += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    data.keyDescriptors.slice(0, 5).forEach((d) => {
      const lines = wrapText(doc, `• ${d}`, rightW - 8, 2);
      lines.forEach((line) => {
        if (ry > blockBottom - 28) return;
        doc.text(line, rightX + 4, ry);
        ry += 3.5;
      });
    });
    ry += 2;
  }

  // Clinician phrase — pinned near bottom of right column
  const phraseMaxH = 28;
  let phraseY = Math.max(ry + 4, blockBottom - phraseMaxH - 4);
  if (phraseY + phraseMaxH > blockBottom - 2) phraseY = blockBottom - phraseMaxH - 2;

  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(251, 113, 133);
  doc.roundedRect(rightX + 3, phraseY, rightW - 6, phraseMaxH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(159, 18, 57);
  doc.text("FRASE PARA EL CLÍNICO", rightX + 6, phraseY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  wrapText(doc, data.clinicianPhrase, rightW - 14, 4).forEach((line, i) => {
    doc.text(line, rightX + 6, phraseY + 11 + i * 4);
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Ficha orientativa de la lesión dominante. No sustituye el informe completo.",
    margin,
    pageH - 8
  );
}
