import type { FindingExplainerData } from "../lib/findingExplainer";
import {
  explainerCardsForPdf,
  shortExplainerRotulo,
} from "../lib/findingExplainer";
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

type PdfCard = ReturnType<typeof explainerCardsForPdf>[number];

type PreparedCard = {
  card: PdfCard;
  eco: string | null;
  cgi: string | null;
  ecoRatio: number;
  cgiRatio: number;
  labelLines: string[];
  labelSize: number;
  siteLine: string;
};

/**
 * Annex — exactly 2 findings per page when possible.
 * Pack-style titles; eco/CGI scaled uniformly (aspect preserved, no stretch/crop).
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
  let y = 20 * factor;

  // ── Pack-style annex header band (page 1 only) ────────────────────────
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

  const headerPadY = 3.4 * factor;
  const titleLineH = 4.4 * factor;
  const metaLineH = 3.5 * factor;
  const headerInnerH = Math.max(
    titleLineH,
    metaLines.length ? metaLines.length * metaLineH : 0
  );
  const annexHeaderH = headerPadY * 2 + headerInnerH;

  doc.setFillColor(41, 37, 36);
  doc.roundedRect(marginX, y, contentWidth, annexHeaderH, 1.5, 1.5, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(marginX, y + annexHeaderH, contentWidth, 1.15 * factor, "F");

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

  y += annexHeaderH + 1.15 * factor + 6.5 * factor;
  const page1CardsTop = y;

  const gap = 5 * factor;
  const imgColW = (contentWidth - gap) / 2;
  const bulletColW = contentWidth;
  const framePad = 1.1 * factor;
  const maxInnerW = imgColW - framePad * 2;
  const badgeH = 3.6 * factor;
  const captionH = 4.6 * factor;

  // Prepare cards (ratios + wrapped titles) once
  const prepared: PreparedCard[] = cards.map((card) => {
    const eco =
      card.ecoImageUrl && String(card.ecoImageUrl).startsWith("data:")
        ? card.ecoImageUrl
        : null;
    const cgi =
      card.cgiImageUrl && String(card.cgiImageUrl).startsWith("data:")
        ? card.cgiImageUrl
        : null;
    const label = sanitizePdfText(card.label || "Hallazgo");
    let labelSize = label.length > 70 ? 11.5 : label.length > 45 ? 12.5 : 13.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(labelSize * factor);
    let labelLines = doc.splitTextToSize(label, contentWidth) as string[];
    if (labelLines.length > 2) {
      labelSize = 11.5;
      doc.setFontSize(labelSize * factor);
      labelLines = (doc.splitTextToSize(label, contentWidth) as string[]).slice(0, 2);
    } else {
      labelLines = labelLines.slice(0, 2);
    }
    let siteLine = "";
    if (card.site) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8 * factor);
      const siteLines = doc.splitTextToSize(
        sanitizePdfText(card.site),
        contentWidth
      ) as string[];
      siteLine = siteLines[0] || "";
    }
    return {
      card,
      eco,
      cgi,
      ecoRatio: eco ? imageRatio(doc, eco) : 4 / 3,
      cgiRatio: cgi ? imageRatio(doc, cgi) : 4 / 3,
      labelLines,
      labelSize,
      siteLine,
    };
  });

  const measureTitleChrome = (p: PreparedCard) => {
    const labelLineH = (p.labelSize * 0.42 + 1.15) * factor;
    return (
      5 * factor + // HALLAZGO N
      p.labelLines.length * labelLineH +
      1.2 * factor +
      (p.siteLine ? 4 * factor : 0) +
      5.5 * factor // amber rule + gap
    );
  };

  const measureTextChrome = () => {
    // Fixed budget for 3 bullets (compact but still readable)
    // QUE ES: label + 2 lines; DONDE: label + 2; IMPLICA: label + 3
    const lineH = 3.5 * factor;
    const labelGap = 4 * factor;
    const after = 2.4 * factor;
    return (
      labelGap + 2 * lineH + after +
      labelGap + 2 * lineH + after +
      labelGap + 3 * lineH + after
    );
  };

  const naturalImgRowH = (p: PreparedCard, innerW: number) => {
    const ecoH = innerW / p.ecoRatio;
    const cgiH = innerW / p.cgiRatio;
    return badgeH + Math.max(ecoH, cgiH) + framePad * 2 + captionH;
  };

  const drawCard = (p: PreparedCard, index: number, innerW: number, startY: number) => {
    let cy = startY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(180, 83, 9);
    doc.text(`HALLAZGO ${index + 1}`, marginX, cy);
    cy += 5 * factor;

    const labelLineH = (p.labelSize * 0.42 + 1.15) * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(p.labelSize * factor);
    doc.setTextColor(28, 25, 23);
    p.labelLines.forEach((line) => {
      doc.text(line, marginX, cy);
      cy += labelLineH;
    });
    cy += 1.2 * factor;

    if (p.siteLine) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8 * factor);
      doc.setTextColor(120, 113, 108);
      doc.text(p.siteLine, marginX, cy);
      cy += 4 * factor;
    }

    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.5);
    doc.line(marginX, cy, marginX + 36 * factor, cy);
    cy += 5.5 * factor;

    const drawSlot = (
      x: number,
      badge: string,
      url: string | null,
      ratio: number,
      caption: string
    ) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(badge, x, cy + 2.2 * factor);

      const boxY = cy + badgeH;
      const drawW = innerW;
      const drawH = drawW / ratio; // aspect preserved — never stretch
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
      doc.setFontSize(6.3 * factor);
      doc.setTextColor(100, 116, 139);
      const cap = sanitizePdfText(caption || "");
      const capLines = doc.splitTextToSize(cap, boxW) as string[];
      doc.text(capLines[0] || "", x, boxY + boxH + 3 * factor);
      return boxY + boxH + captionH;
    };

    const yEco = drawSlot(
      marginX,
      "ECO REAL",
      p.eco,
      p.ecoRatio,
      shortExplainerRotulo({
        findingLabel: p.card.label,
        galleryCaption: p.card.ecoCaption,
        fallback: p.card.label || "Captura del estudio",
      })
    );
    const yCgi = drawSlot(
      marginX + imgColW + gap,
      "CGI 3D",
      p.cgi,
      p.cgiRatio,
      shortExplainerRotulo({
        findingLabel: p.card.label,
        galleryCaption: p.card.cgiCaption,
        fallback: p.card.label,
      })
    );
    cy = Math.max(yEco, yCgi) + 3.5 * factor;

    const bullets = [
      { k: "Que es", v: p.card.whatIs, maxLines: 2 },
      { k: "Donde", v: p.card.whereIs, maxLines: 2 },
      { k: "Que implica", v: p.card.implies, maxLines: 3 },
    ].filter((b) => String(b.v || "").trim());

    const lineH = 3.5 * factor;
    bullets.forEach((b) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5 * factor);
      doc.setTextColor(180, 83, 9);
      doc.text(b.k.toUpperCase(), marginX, cy);
      cy += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5 * factor);
      doc.setTextColor(41, 37, 36);
      const lines = doc.splitTextToSize(sanitizePdfText(b.v), bulletColW) as string[];
      lines.slice(0, b.maxLines).forEach((line) => {
        doc.text(line, marginX, cy);
        cy += lineH;
      });
      cy += 2.4 * factor;
    });

    return cy;
  };

  // Render in pages of exactly 2 (last page may have 1)
  for (let pageStart = 0; pageStart < prepared.length; pageStart += cardsPerPage) {
    const pageCards = prepared.slice(pageStart, pageStart + cardsPerPage);
    const isFirstPage = pageStart === 0;

    if (!isFirstPage) {
      doc.addPage();
      y = 20 * factor;
    } else {
      y = page1CardsTop;
    }

    const avail = Math.max(40 * factor, bottom - y);
    const sepH = pageCards.length > 1 ? 8 * factor : 0;
    const titleChrome = pageCards.reduce((a, p) => a + measureTitleChrome(p), 0);
    const textChrome = pageCards.length * measureTextChrome();
    const fixed = titleChrome + textChrome + sepH;
    const imgBudget = Math.max(36 * factor, avail - fixed);

    const naturalRows = pageCards.map((p) => naturalImgRowH(p, maxInnerW));
    const naturalSum = naturalRows.reduce((a, b) => a + b, 0) || 1;
    // Uniform scale of WIDTH (height follows aspect) — no distortion
    const scale = Math.min(1, imgBudget / naturalSum);
    const innerW = Math.max(28 * factor, maxInnerW * scale);

    pageCards.forEach((p, localIdx) => {
      const globalIdx = pageStart + localIdx;
      y = drawCard(p, globalIdx, innerW, y);

      if (localIdx < pageCards.length - 1) {
        y += 2.5 * factor;
        doc.setDrawColor(231, 229, 228);
        doc.setLineWidth(0.35);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 5.5 * factor;
      }
    });
  }
}
