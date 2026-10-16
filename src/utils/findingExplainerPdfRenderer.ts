import type { FindingExplainerData } from "../lib/findingExplainer";
import { explainerCardsForPdf } from "../lib/findingExplainer";
import { sanitizePdfText } from "./sanitizePdfText";

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

/**
 * One annex page (or more) — stacked finding explainers:
 * each card = eco | CGI + 3 bullets.
 */
export function renderFindingExplainerAnnexToPDF(
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
  y += 6 * factor;

  if (data?.studyRegion) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * factor);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(data.studyRegion), marginX, y);
    y += 6 * factor;
  }

  const gap = 5 * factor;
  const imgColW = (contentWidth - gap) / 2;
  const bulletColW = contentWidth;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const eco = card.ecoImageUrl && String(card.ecoImageUrl).startsWith("data:")
      ? card.ecoImageUrl
      : null;
    const cgi = card.cgiImageUrl && String(card.cgiImageUrl).startsWith("data:")
      ? card.cgiImageUrl
      : null;

    // Estimate card height
    const maxInnerW = imgColW - 2 * factor;
    const ecoH = eco ? maxInnerW / imageRatio(doc, eco) : 28 * factor;
    const cgiH = cgi ? maxInnerW / imageRatio(doc, cgi) : 28 * factor;
    const imgBlockH = Math.max(ecoH, cgiH) + 10 * factor;
    const textBlockH = 28 * factor;
    const need = 10 * factor + imgBlockH + textBlockH;

    if (y + need > bottom && i > 0) {
      doc.addPage();
      y = 22 * factor;
    }

    // Card header
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 186, 116);
    doc.setLineWidth(0.3);
    const headerH = 9 * factor;
    doc.roundedRect(marginX, y, contentWidth, headerH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(146, 64, 14);
    doc.text(
      sanitizePdfText(`${i + 1}. ${card.label}`),
      marginX + 3 * factor,
      y + 5.8 * factor
    );
    if (card.site) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(120, 113, 108);
      const site = sanitizePdfText(card.site);
      const siteW = doc.getTextWidth(site);
      if (siteW < contentWidth * 0.45) {
        doc.text(site, marginX + contentWidth - 3 * factor - siteW, y + 5.8 * factor);
      }
    }
    y += headerH + 4 * factor;

    // Images row
    const drawSlot = (
      x: number,
      badge: string,
      url: string | null,
      caption: string,
      naturalH: number
    ) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(badge, x, y + 2.2 * factor);
      const boxY = y + 3.6 * factor;
      const drawH = Math.min(naturalH, 42 * factor);
      const drawW = maxInnerW;
      doc.setFillColor(250, 250, 249);
      doc.setDrawColor(214, 211, 209);
      doc.roundedRect(x, boxY, drawW + 2 * factor, drawH + 2 * factor, 1.2, 1.2, "FD");
      if (url) {
        drawImage(doc, url, x + factor, boxY + factor, drawW, drawH);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(148, 163, 184);
        doc.text("Sin imagen", x + 4 * factor, boxY + drawH / 2);
      }
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(100, 116, 139);
      const cap = sanitizePdfText(caption || "");
      const capLines = doc.splitTextToSize(cap, drawW) as string[];
      doc.text(capLines[0] || "", x, boxY + drawH + 2 * factor + 3 * factor);
      return boxY + drawH + 2 * factor + 6 * factor;
    };

    const yEco = drawSlot(
      marginX,
      "ECO REAL",
      eco,
      card.ecoCaption || "Captura del estudio",
      ecoH
    );
    const yCgi = drawSlot(
      marginX + imgColW + gap,
      "CGI 3D",
      cgi,
      card.cgiCaption || card.label,
      cgiH
    );
    y = Math.max(yEco, yCgi) + 3 * factor;

    // Three bullets
    const bullets = [
      { k: "Que es", v: card.whatIs },
      { k: "Donde", v: card.whereIs },
      { k: "Que implica", v: card.implies },
    ].filter((b) => String(b.v || "").trim());

    bullets.forEach((b) => {
      if (y > bottom - 10 * factor) {
        doc.addPage();
        y = 22 * factor;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(b.k.toUpperCase(), marginX, y);
      y += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9 * factor);
      doc.setTextColor(41, 37, 36);
      const lines = doc.splitTextToSize(sanitizePdfText(b.v), bulletColW) as string[];
      lines.slice(0, 3).forEach((line) => {
        doc.text(line, marginX, y);
        y += 3.8 * factor;
      });
      y += 2.5 * factor;
    });

    y += 5 * factor;

    // Separator between cards
    if (i < cards.length - 1) {
      doc.setDrawColor(231, 229, 228);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 6 * factor;
    }
  }
}
