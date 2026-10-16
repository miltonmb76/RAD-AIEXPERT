import type { FindingExplainerData } from "../lib/findingExplainer";
import { explainerCardsForPdf } from "../lib/findingExplainer";
import { sanitizePdfText } from "./sanitizePdfText";

function imageRatio(doc: any, dataUrl: string, fallback = 4 / 3): number {
  try {
    const props = doc.getImageProperties(dataUrl);
    const iw = Number(props?.width) || 0;
    const ih = Number(props?.height) || 0;
    if (iw > 0 && ih > 0) return iw / ih;
  } catch {
    /* ignore */
  }
  return fallback;
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
 * Annex — stacked finding explainers (~2 per page when they fit):
 * Pack-style titles, eco | CGI at natural aspect (full height, snug frame), bullets.
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
  let y = 20 * factor;

  // ── Pack-style annex header band ──────────────────────────────────────
  const rawTitle = sanitizePdfText(data?.title || "EXPLAINER DE HALLAZGOS");
  const titleLeft = rawTitle.toUpperCase().startsWith("ANEXO")
    ? rawTitle
    : `ANEXO: ${rawTitle}`;
  const metaRaw = data?.studyRegion
    ? sanitizePdfText(String(data.studyRegion))
    : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10 * factor);
  const titleW = Math.min(doc.getTextWidth(titleLeft) + 2, contentWidth * 0.62);
  const metaMaxW = Math.max(24, contentWidth - titleW - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * factor);
  const metaLines: string[] = metaRaw
    ? (doc.splitTextToSize(metaRaw, metaMaxW) as string[]).slice(0, 2)
    : [];

  const headerPadY = 3.6 * factor;
  const titleLineH = 4.6 * factor;
  const metaLineH = 3.6 * factor;
  const headerInnerH = Math.max(
    titleLineH,
    metaLines.length ? metaLines.length * metaLineH : 0
  );
  const annexHeaderH = headerPadY * 2 + headerInnerH;

  doc.setFillColor(41, 37, 36);
  doc.roundedRect(marginX, y, contentWidth, annexHeaderH, 1.5, 1.5, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(marginX, y + annexHeaderH, contentWidth, 1.2 * factor, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10 * factor);
  doc.setTextColor(255, 251, 235);
  doc.text(titleLeft, marginX + 4 * factor, y + headerPadY + titleLineH * 0.78);

  if (metaLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5 * factor);
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

  y += annexHeaderH + 1.2 * factor + 8 * factor;

  const gap = 5 * factor;
  const imgColW = (contentWidth - gap) / 2;
  const bulletColW = contentWidth;
  const framePad = 1.2 * factor;
  const maxInnerW = imgColW - framePad * 2;
  const badgeH = 4 * factor;
  const captionH = 5 * factor;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const eco =
      card.ecoImageUrl && String(card.ecoImageUrl).startsWith("data:")
        ? card.ecoImageUrl
        : null;
    const cgi =
      card.cgiImageUrl && String(card.cgiImageUrl).startsWith("data:")
        ? card.cgiImageUrl
        : null;

    // Natural height from aspect — full width, no crop / no letterbox
    const ecoRatio = eco ? imageRatio(doc, eco) : 4 / 3;
    const cgiRatio = cgi ? imageRatio(doc, cgi) : 4 / 3;
    const ecoH = maxInnerW / ecoRatio;
    const cgiH = maxInnerW / cgiRatio;
    const imgBlockH = Math.max(ecoH, cgiH, 28 * factor) + framePad * 2;

    // Estimate card height for page-break (2 per page when they fit)
    const titleBlockEst = 18 * factor;
    const textBlockEst = 38 * factor;
    const need =
      titleBlockEst + badgeH + imgBlockH + captionH + textBlockEst + 10 * factor;

    const isPageStart = i > 0 && i % cardsPerPage === 0;
    if (isPageStart || (i > 0 && y + need > bottom)) {
      doc.addPage();
      y = 20 * factor;
    }

    // ── Pack-style finding title (eyebrow + large name + amber rule) ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8 * factor);
    doc.setTextColor(180, 83, 9);
    doc.text(`HALLAZGO ${i + 1}`, marginX, y);
    y += 5.5 * factor;

    const label = sanitizePdfText(card.label || `Hallazgo ${i + 1}`);
    doc.setFont("helvetica", "bold");
    let labelSize = label.length > 70 ? 12 : label.length > 45 ? 13 : 14.5;
    doc.setFontSize(labelSize * factor);
    let labelLines = doc.splitTextToSize(label, contentWidth) as string[];
    if (labelLines.length > 2 && labelSize > 12) {
      labelSize = 12;
      doc.setFontSize(labelSize * factor);
      labelLines = doc.splitTextToSize(label, contentWidth) as string[];
    }
    const labelLineH = labelSize * 0.42 + 1.2;
    doc.setTextColor(28, 25, 23);
    labelLines.slice(0, 2).forEach((line) => {
      doc.text(line, marginX, y);
      y += labelLineH * factor;
    });
    y += 1.5 * factor;

    if (card.site) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5 * factor);
      doc.setTextColor(120, 113, 108);
      const siteLines = doc.splitTextToSize(
        sanitizePdfText(card.site),
        contentWidth
      ) as string[];
      doc.text(siteLines[0] || "", marginX, y);
      y += 4.5 * factor;
    }

    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, marginX + 36 * factor, y);
    y += 6.5 * factor;

    const drawSlot = (
      x: number,
      badge: string,
      url: string | null,
      naturalH: number,
      caption: string
    ) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(badge, x, y + 2.4 * factor);

      const boxY = y + badgeH;
      const drawW = maxInnerW;
      const drawH = naturalH;
      const boxW = drawW + framePad * 2;
      const boxH = drawH + framePad * 2;

      doc.setFillColor(250, 250, 249);
      doc.setDrawColor(214, 211, 209);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, boxY, boxW, boxH, 1.2, 1.2, "FD");

      if (url) {
        drawImage(doc, url, x + framePad, boxY + framePad, drawW, drawH);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5 * factor);
        doc.setTextColor(148, 163, 184);
        doc.text("Sin imagen", x + 4 * factor, boxY + boxH / 2);
      }

      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5 * factor);
      doc.setTextColor(100, 116, 139);
      const cap = sanitizePdfText(caption || "");
      const capLines = doc.splitTextToSize(cap, boxW) as string[];
      doc.text(capLines[0] || "", x, boxY + boxH + 3.2 * factor);
      return boxY + boxH + captionH;
    };

    const yEco = drawSlot(
      marginX,
      "ECO REAL",
      eco,
      ecoH,
      card.ecoCaption || "Captura del estudio"
    );
    const yCgi = drawSlot(
      marginX + imgColW + gap,
      "CGI 3D",
      cgi,
      cgiH,
      card.cgiCaption || card.label
    );
    y = Math.max(yEco, yCgi) + 5 * factor;

    // Three bullets — Pack-style amber section labels, more air
    const bullets = [
      { k: "Que es", v: card.whatIs, maxLines: 3 },
      { k: "Donde", v: card.whereIs, maxLines: 2 },
      { k: "Que implica", v: card.implies, maxLines: 4 },
    ].filter((b) => String(b.v || "").trim());

    const lineH = 3.8 * factor;
    bullets.forEach((b) => {
      if (y > bottom - 10 * factor) {
        doc.addPage();
        y = 20 * factor;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(b.k.toUpperCase(), marginX, y);
      y += 4.5 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9 * factor);
      doc.setTextColor(41, 37, 36);
      const lines = doc.splitTextToSize(sanitizePdfText(b.v), bulletColW) as string[];
      lines.slice(0, b.maxLines).forEach((line) => {
        doc.text(line, marginX, y);
        y += lineH;
      });
      y += 3.2 * factor;
    });

    // Separator + air between the two cards on the same page
    if (i < cards.length - 1 && (i + 1) % cardsPerPage !== 0) {
      y += 3 * factor;
      doc.setDrawColor(231, 229, 228);
      doc.setLineWidth(0.35);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 7 * factor;
    }
  }
}
