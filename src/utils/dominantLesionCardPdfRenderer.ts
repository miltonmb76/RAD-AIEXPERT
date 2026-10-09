import type { jsPDF } from "jspdf";
import type { DominantLesionCardData } from "../lib/dominantLesionCard";
import { sanitizePdfText } from "./sanitizePdfText";

function wrapText(doc: jsPDF, text: string, maxW: number, maxLines: number): string[] {
  const lines = doc.splitTextToSize(sanitizePdfText(text || ""), maxW) as string[];
  if (lines.length <= maxLines) return lines;
  const sliced = lines.slice(0, maxLines);
  const last = sliced[maxLines - 1] || "";
  sliced[maxLines - 1] = last.length > 3 ? `${last.slice(0, -2)}…` : last;
  return sliced;
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

/** Fill tile exactly (cover-crop via canvas). No letterbox bars. */
function coverCropDataUrl(
  img: HTMLImageElement,
  boxWmm: number,
  boxHmm: number,
  maxPx = 1400
): string | null {
  try {
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const targetAspect = boxWmm / Math.max(0.1, boxHmm);
    let srcW = iw;
    let srcH = iw / targetAspect;
    if (srcH > ih) {
      srcH = ih;
      srcW = ih * targetAspect;
    }
    const sx = Math.max(0, (iw - srcW) / 2);
    const sy = Math.max(0, (ih - srcH) / 2);
    const outW = Math.min(maxPx, Math.max(240, Math.round(boxWmm * 8)));
    const outH = Math.max(120, Math.round(outW / targetAspect));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

/**
 * Snug height for a tile: prefer image aspect so US isn't floating in a tall well.
 * Falls back to a compact default when no image.
 */
function snugTileHeight(img: HTMLImageElement | null, boxW: number, maxH: number, minH = 36): number {
  if (!img) return Math.min(maxH, 48);
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const aspectH = boxW * (ih / iw);
  // Cap extreme panoramas / portraits
  return Math.max(minH, Math.min(maxH, aspectH));
}

async function drawMediaTile(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  caption: string,
  x: number,
  y: number,
  w: number,
  h: number,
  emptyLabel: string,
  preloaded?: HTMLImageElement | null
): Promise<void> {
  const capH = 5;
  const imgH = Math.max(16, h - capH);
  const pad = 0.8;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(x, y, w, h, 1.4, 1.4, "F");

  const img = preloaded !== undefined ? preloaded : dataUrl ? await loadImage(dataUrl) : null;
  if (dataUrl && img) {
    try {
      const boxW = w - pad * 2;
      const boxH = imgH - pad * 2;
      const cropped = coverCropDataUrl(img, boxW, boxH);
      if (cropped) {
        doc.addImage(cropped, "JPEG", x + pad, y + pad, boxW, boxH);
      } else {
        const iw = img.width || 1;
        const ih = img.height || 1;
        // Contain into snug box (should nearly fill when h was sized from aspect)
        const s = Math.min(boxW / iw, boxH / ih);
        const dw = iw * s;
        const dh = ih * s;
        const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        doc.addImage(
          dataUrl,
          fmt,
          x + pad + (boxW - dw) / 2,
          y + pad + (boxH - dh) / 2,
          dw,
          dh
        );
      }
    } catch {
      /* ignore */
    }
    doc.setFillColor(15, 23, 42);
    doc.rect(x, y + imgH, w, capH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(226, 232, 240);
    const cap = wrapText(doc, caption || emptyLabel, w - 3.2, 1)[0] || emptyLabel;
    doc.text(cap, x + 1.6, y + imgH + 3.3);
    return;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(emptyLabel, x + w / 2, y + h / 2, { align: "center" });
}

/**
 * One-page annex — clear of running header (line at y=14), snug US tiles
 * (height from image aspect + cover fill), side panel = content height,
 * phrase clear of global footer at pageH-10.
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
  const margin = 14;
  const contentW = pageW - margin * 2;
  const layout = data.imageLayout || "single";
  // Footer text at pageH-10; keep content above
  const footerClear = 18;

  // Soft wash only below running-header separator
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 15.2, pageW, pageH - 15.2, "F");

  // Same clearance as vascular/thyroid annexes
  let y = 22;

  // Compact masthead (never under the y=14 running header line)
  const headH = 20;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentW, headH, 2.2, 2.2, "F");
  doc.setFillColor(190, 18, 60);
  doc.rect(margin, y + headH - 1.3, contentW, 1.3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(251, 113, 133);
  doc.text("LESIÓN DOMINANTE", margin + 3.5, y + 5.2);

  const cat = [data.categorySystem, data.categoryValue].filter(Boolean).join(" ");
  let titleMaxW = contentW - 8;
  if (cat) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const catLabel = sanitizePdfText(cat).slice(0, 16);
    const catW = Math.min(40, Math.max(20, doc.getTextWidth(catLabel) + 7));
    const catX = margin + contentW - catW - 2.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(catX, y + 4.5, catW, 8, 1.4, 1.4, "F");
    doc.setTextColor(159, 18, 57);
    doc.text(catLabel, catX + catW / 2, y + 9.8, { align: "center" });
    titleMaxW = contentW - catW - 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  const titleLine = wrapText(doc, data.lesionLabel, titleMaxW, 1)[0] || "Lesión dominante";
  doc.text(titleLine, margin + 3.5, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  const meta = [data.site, data.laterality, data.studyRegion].filter(Boolean).join(" · ");
  doc.text(wrapText(doc, meta, titleMaxW, 1)[0] || "", margin + 3.5, y + 16.8);

  y += headH + 4;

  const gap = 4.5;
  const mediaW = contentW * 0.52;
  const sideW = contentW - mediaW - gap;
  const mediaX = margin;
  const sideX = margin + mediaW + gap;
  const sidePadX = 3.5;
  const innerW = sideW - sidePadX * 2;
  const sideTop = y;

  // Preload images to size tiles from real aspect ratios
  const [imgA, imgB, img3d] = await Promise.all([
    opts?.imageDataUrl ? loadImage(opts.imageDataUrl) : Promise.resolve(null),
    opts?.imageBDataUrl ? loadImage(opts.imageBDataUrl) : Promise.resolve(null),
    opts?.focal3dDataUrl ? loadImage(opts.focal3dDataUrl) : Promise.resolve(null),
  ]);

  const phraseBudget = 32;
  const maxStackH = pageH - y - phraseBudget - footerClear;

  let mediaColumnH = 0;

  if (layout === "mmg_us") {
    const cellW = (mediaW - 2.5) / 2;
    const maxCellH = Math.min(78, maxStackH);
    const hA = snugTileHeight(imgA, cellW, maxCellH, 40);
    const hB = snugTileHeight(imgB, cellW, maxCellH, 40);
    const cellH = Math.max(hA, hB);
    mediaColumnH = cellH;
    await drawMediaTile(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || "MMG",
      mediaX,
      y,
      cellW,
      cellH,
      "Sin MMG",
      imgA
    );
    await drawMediaTile(
      doc,
      opts?.imageBDataUrl,
      opts?.imageBCaption || "US",
      mediaX + cellW + 2.5,
      y,
      cellW,
      cellH,
      "Sin US",
      imgB
    );
  } else if (layout === "clinical_3d") {
    // Stacked like the on-screen preview, but each row snug to its image
    const rowGap = 2.2;
    const maxEach = Math.min(58, (maxStackH - rowGap) / 2);
    const topH = snugTileHeight(imgA, mediaW, maxEach, 38);
    const botH = snugTileHeight(img3d, mediaW, maxEach, 38);
    mediaColumnH = topH + rowGap + botH;
    await drawMediaTile(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || "Imagen clínica",
      mediaX,
      y,
      mediaW,
      topH,
      "Sin imagen clínica",
      imgA
    );
    await drawMediaTile(
      doc,
      opts?.focal3dDataUrl,
      opts?.focal3dCaption || "Corte 3D",
      mediaX,
      y + topH + rowGap,
      mediaW,
      botH,
      "Sin corte 3D",
      img3d
    );
  } else {
    const maxH = Math.min(86, maxStackH);
    mediaColumnH = snugTileHeight(imgA, mediaW, maxH, 44);
    await drawMediaTile(
      doc,
      opts?.imageDataUrl,
      opts?.imageCaption || (data.figureRef ? `Figura ${data.figureRef}` : "Imagen clínica"),
      mediaX,
      y,
      mediaW,
      mediaColumnH,
      "Sin imagen asociada",
      imgA
    );
  }

  // Side facts — height follows content (not stretched to media column)
  let plannedH = 7;
  plannedH += 4.5;
  const sizeLines = wrapText(doc, data.sizeSummary || "—", innerW, 2);
  plannedH += sizeLines.length * 5 + 3;

  const measCount = Math.min(4, data.measurements.length);
  const measRows = Math.ceil(measCount / 2) || 0;
  if (measCount) plannedH += measRows * 12 + 2;

  doc.setFontSize(7);
  const rationaleLines = data.categoryRationale
    ? wrapText(doc, data.categoryRationale, innerW, 3)
    : [];
  if (rationaleLines.length) plannedH += 4.5 + rationaleLines.length * 3.2 + 2;

  const descriptors = (data.keyDescriptors || []).slice(0, 4);
  if (descriptors.length) plannedH += 4.5 + descriptors.length * 6 + 2;

  // Content-sized only — never stretch to media column (avoids empty white)
  const sideH = Math.min(maxStackH, Math.max(42, plannedH + 3));

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(sideX, sideTop, sideW, sideH, 2, 2, "FD");

  const bottomLimit = sideTop + sideH - 2.5;
  let sy = sideTop + 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("TAMAÑO", sideX + sidePadX, sy);
  sy += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  for (const line of sizeLines) {
    if (sy > bottomLimit - 3) break;
    doc.text(line, sideX + sidePadX, sy);
    sy += 4.8;
  }
  sy += 2;

  if (measCount && sy < bottomLimit - 11) {
    const cellW = (innerW - 2) / 2;
    let cx = sideX + sidePadX;
    let row = 0;
    data.measurements.slice(0, 4).forEach((m, i) => {
      if (i > 0 && i % 2 === 0) {
        cx = sideX + sidePadX;
        row += 1;
      }
      const cy = sy + row * 12;
      if (cy + 10 > bottomLimit) return;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cx, cy, cellW - 1.5, 10.5, 1.1, 1.1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5);
      doc.setTextColor(148, 163, 184);
      const label = wrapText(doc, sanitizePdfText(m.label).toUpperCase(), cellW - 4, 1)[0] || "";
      doc.text(label, cx + 1.6, cy + 3.4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const val = wrapText(doc, m.value, cellW - 4, 1)[0] || "";
      doc.text(val, cx + 1.6, cy + 8);
      cx += cellW;
    });
    sy += measRows * 12 + 2;
  }

  if (rationaleLines.length && sy < bottomLimit - 9) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("FUNDAMENTO", sideX + sidePadX, sy);
    sy += 3.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    for (const line of rationaleLines) {
      if (sy > bottomLimit - 2.5) break;
      doc.text(line, sideX + sidePadX, sy);
      sy += 3.1;
    }
    sy += 1.5;
  }

  if (descriptors.length && sy < bottomLimit - 7) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("DESCRIPTORES", sideX + sidePadX, sy);
    sy += 4.2;
    for (const d of descriptors) {
      if (sy > bottomLimit - 2.5) break;
      const label = wrapText(doc, d, innerW - 4, 1)[0] || "";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      const tw = Math.min(innerW, doc.getTextWidth(label) + 4.5);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(sideX + sidePadX, sy - 2.5, tw, 5, 1.1, 1.1, "F");
      doc.setTextColor(51, 65, 85);
      doc.text(label, sideX + sidePadX + 2, sy + 0.5);
      sy += 5.8;
    }
  }

  // Phrase tight under content — never into footer
  y = Math.max(sideTop + mediaColumnH, sideTop + sideH) + 4;
  const phraseMaxH = 26;
  const phraseH = Math.min(phraseMaxH, pageH - y - footerClear);
  if (phraseH >= 16 && data.clinicianPhrase) {
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, phraseH, 1.8, 1.8, "FD");
    doc.setFillColor(225, 29, 72);
    doc.rect(margin, y, 1.8, phraseH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(190, 18, 60);
    doc.text("PARA EL CLÍNICO", margin + 5.5, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const maxPhraseLines = Math.max(1, Math.floor((phraseH - 9) / 3.9));
    wrapText(doc, data.clinicianPhrase, contentW - 12, maxPhraseLines).forEach((line, i) => {
      doc.text(line, margin + 5.5, y + 10.5 + i * 3.9);
    });
    y += phraseH + 3;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Ficha orientativa · no sustituye el informe completo",
    margin,
    Math.min(pageH - footerClear + 2, y + 1.5)
  );
}
