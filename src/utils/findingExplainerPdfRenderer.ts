import type { FindingExplainerData } from "../lib/findingExplainer";
import { explainerCardsForPdf } from "../lib/findingExplainer";
import { sanitizePdfText } from "./sanitizePdfText";

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!dataUrl || !String(dataUrl).startsWith("data:")) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Fill box exactly (cover-crop). No letterbox bars on the sides. */
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
    const outW = Math.min(maxPx, Math.max(280, Math.round(boxWmm * 10)));
    const outH = Math.max(160, Math.round(outW / targetAspect));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
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
    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, "FAST");
  } catch {
    doc.setFillColor(245, 245, 244);
    doc.rect(x, y, w, h, "F");
  }
}

/**
 * Annex — stacked finding explainers, ~2 cards per page:
 * each card = eco | CGI (edge-to-edge cover) + 3 bullets.
 */
export async function renderFindingExplainerAnnexToPDF(
  doc: any,
  data: FindingExplainerData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  const cards = explainerCardsForPdf(data);
  if (!cards.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const bottom = pageHeight - 14 * factor;
  const cardsPerPage = 2;

  doc.addPage();
  // Clear of running header rule (~15.5)
  let y = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  const title = sanitizePdfText(data?.title || "ANEXO: EXPLAINER DE HALLAZGOS");
  doc.text(title.toUpperCase().startsWith("ANEXO") ? title : `ANEXO: ${title}`, marginX, y);
  y += 5 * factor;

  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, marginX + 48 * factor, y);
  y += 5 * factor;

  if (data?.studyRegion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(data.studyRegion), marginX, y);
    y += 5 * factor;
  }

  const gap = 4 * factor;
  const imgColW = (contentWidth - gap) / 2;
  const bulletColW = contentWidth;
  // Frame fills the column; image cover-fills the frame (no side gaps)
  const boxW = imgColW;
  const badgeH = 3.2 * factor;
  const captionH = 4.2 * factor;
  const headerH = 8 * factor;
  const imgBoxH = 52 * factor; // larger than before (~38); sized for 2 cards/page
  const slotH = badgeH + imgBoxH + captionH;

  // Preload all images for cover-crop
  const loaded = await Promise.all(
    cards.map(async (card) => {
      const ecoUrl =
        card.ecoImageUrl && String(card.ecoImageUrl).startsWith("data:")
          ? card.ecoImageUrl
          : null;
      const cgiUrl =
        card.cgiImageUrl && String(card.cgiImageUrl).startsWith("data:")
          ? card.cgiImageUrl
          : null;
      const [ecoImg, cgiImg] = await Promise.all([
        ecoUrl ? loadImage(ecoUrl) : Promise.resolve(null),
        cgiUrl ? loadImage(cgiUrl) : Promise.resolve(null),
      ]);
      return { ecoUrl, cgiUrl, ecoImg, cgiImg };
    })
  );

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const media = loaded[i];

    // Exactly 2 findings per page (after the title block on page 1)
    if (i > 0 && i % cardsPerPage === 0) {
      doc.addPage();
      y = 22 * factor;
    }

    // Card header
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, contentWidth, headerH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(146, 64, 14);
    doc.text(
      sanitizePdfText(`${i + 1}. ${card.label}`),
      marginX + 3 * factor,
      y + 5.4 * factor
    );
    if (card.site) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(120, 113, 108);
      const site = sanitizePdfText(card.site);
      const siteW = doc.getTextWidth(site);
      if (siteW < contentWidth * 0.42) {
        doc.text(site, marginX + contentWidth - 3 * factor - siteW, y + 5.4 * factor);
      }
    }
    y += headerH + 2.8 * factor;

    const drawSlot = (
      x: number,
      badge: string,
      url: string | null,
      img: HTMLImageElement | null,
      caption: string
    ) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(badge, x, y + 2.1 * factor);

      const boxY = y + badgeH;

      doc.setFillColor(250, 250, 249);
      doc.setDrawColor(214, 211, 209);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, boxY, boxW, imgBoxH, 1.2, 1.2, "FD");

      if (url && img) {
        const cropped = coverCropDataUrl(img, boxW, imgBoxH);
        if (cropped) {
          // Edge-to-edge inside the frame (no lateral padding / letterbox)
          drawImage(doc, cropped, x, boxY, boxW, imgBoxH);
          // Redraw border on top so cover crop doesn't hide the stroke
          doc.setDrawColor(214, 211, 209);
          doc.setLineWidth(0.35);
          doc.roundedRect(x, boxY, boxW, imgBoxH, 1.2, 1.2, "S");
        } else {
          drawImage(doc, url, x, boxY, boxW, imgBoxH);
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(148, 163, 184);
        doc.text("Sin imagen", x + 4 * factor, boxY + imgBoxH / 2);
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(100, 116, 139);
      const cap = sanitizePdfText(caption || "");
      const capLines = doc.splitTextToSize(cap, boxW) as string[];
      doc.text(capLines[0] || "", x, boxY + imgBoxH + 3 * factor);
      return boxY + imgBoxH + captionH;
    };

    const yEco = drawSlot(
      marginX,
      "ECO REAL",
      media.ecoUrl,
      media.ecoImg,
      card.ecoCaption || "Captura del estudio"
    );
    const yCgi = drawSlot(
      marginX + imgColW + gap,
      "CGI 3D",
      media.cgiUrl,
      media.cgiImg,
      card.cgiCaption || card.label
    );
    y = Math.max(yEco, yCgi) + 2.2 * factor;

    // Three bullets — "Que implica" = explanatory meaning, not management
    const bullets = [
      { k: "Que es", v: card.whatIs, maxLines: 2 },
      { k: "Donde", v: card.whereIs, maxLines: 2 },
      { k: "Que implica", v: card.implies, maxLines: 3 },
    ].filter((b) => String(b.v || "").trim());

    const lineH = 3.5 * factor;
    bullets.forEach((b) => {
      if (y > bottom - 8 * factor) {
        doc.addPage();
        y = 22 * factor;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(b.k.toUpperCase(), marginX, y);
      y += 3.6 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5 * factor);
      doc.setTextColor(41, 37, 36);
      const lines = doc.splitTextToSize(sanitizePdfText(b.v), bulletColW) as string[];
      lines.slice(0, b.maxLines).forEach((line) => {
        doc.text(line, marginX, y);
        y += lineH;
      });
      y += 1.8 * factor;
    });

    // Separator between the two cards on the same page
    if (i < cards.length - 1 && (i + 1) % cardsPerPage !== 0) {
      y += 2 * factor;
      doc.setDrawColor(231, 229, 228);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4 * factor;
    }
  }
}
