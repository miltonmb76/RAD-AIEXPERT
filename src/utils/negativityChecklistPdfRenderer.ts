import { NegativityChecklistData } from "../types";
import {
  buildDiscardedFindingsSynopsis,
  negativityStatusLabel,
} from "../lib/negativityChecklist";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * One-page annex: Checklist de negatividad dirigida.
 * Typography aligned with suite fichas (thyroid/kidney ~8–8.5 pt body).
 * Patient-facing: no "insertado" / "acción" language.
 */
export function renderNegativityChecklistAnnexToPDF(
  doc: any,
  data: NegativityChecklistData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 14 * factor;
  const accent: [number, number, number] = [13, 148, 136]; // teal-600
  const softFill: [number, number, number] = [240, 253, 250];
  const softBorder: [number, number, number] = [153, 246, 228];
  const pad = 1.6 * factor;

  // Suite-aligned type scale (thyroid/kidney fichas use ~8.0–8.4 body, ~8.4 header)
  const fsTitle = 12.5 * factor;
  const fsBanner = 9.5 * factor;
  const fsBannerMeta = 8.4 * factor;
  const fsSummary = 8.6 * factor;
  const fsHeader = 8.4 * factor;
  const fsBody = 8.2 * factor;
  const fsBodyEm = 8.4 * factor;
  const fsFooterLabel = 8.8 * factor;
  const fsFooterBody = 8.2 * factor;

  doc.addPage();
  let y = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CHECKLIST DE NEGATIVIDAD DIRIGIDA", marginX, y);
  y += 4.5 * factor;

  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5.5 * factor;

  const closed = (data.openGapsCount || 0) === 0;
  const bannerTitle = sanitizePdfText(
    `${data.protocolName || data.title || "Protocolo"} — ${data.studyRegion || "Estudio"}`
  );
  const bannerMeta = closed
    ? data.technicalGaps?.length
      ? "CERRADO CON LIMITACIONES TECNICAS"
      : "CHECKLIST CERRADO"
    : `INCOMPLETO — ${data.openGapsCount} pendiente(s) de cierre`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  const titleLines = doc.splitTextToSize(bannerTitle, contentWidth - 14 * factor).slice(0, 2);
  const bannerH = Math.max(15 * factor, titleLines.length * 4.4 * factor + 11 * factor);
  doc.setFillColor(softFill[0], softFill[1], softFill[2]);
  doc.setDrawColor(softBorder[0], softBorder[1], softBorder[2]);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.8, 1.8, "FD");
  doc.setFillColor(
    closed ? (data.technicalGaps?.length ? 217 : 5) : 220,
    closed ? (data.technicalGaps?.length ? 119 : 150) : 38,
    closed ? (data.technicalGaps?.length ? 6 : 105) : 38
  );
  doc.rect(marginX, y, 2.8 * factor, bannerH, "F");

  doc.setTextColor(15, 118, 110);
  let ty = y + 5.2 * factor;
  titleLines.forEach((line: string) => {
    doc.text(line, marginX + 6 * factor, ty);
    ty += 4.4 * factor;
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBannerMeta);
  doc.setTextColor(closed ? 22 : 153, closed ? 101 : 27, closed ? 52 : 27);
  doc.text(sanitizePdfText(bannerMeta), marginX + 6 * factor, y + bannerH - 3.8 * factor);
  y += bannerH + 4 * factor;

  // Closure summary box
  const summary = sanitizePdfText(data.closureSummary || "");
  if (summary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsSummary);
    const sumLines = doc.splitTextToSize(summary, contentWidth - 10 * factor).slice(0, 3);
    const boxH = sumLines.length * 3.8 * factor + 5.5 * factor;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, y, contentWidth, boxH, 1.4, 1.4, "FD");
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(marginX, y, 2 * factor, boxH, "F");
    doc.setTextColor(51, 65, 85);
    let sy = y + 4.6 * factor;
    sumLines.forEach((line: string) => {
      doc.text(line, marginX + 5 * factor, sy);
      sy += 3.8 * factor;
    });
    y += boxH + 4 * factor;
  }

  const cols = [
    { label: "Signo / estructura", w: contentWidth * 0.28 },
    { label: "Lado", w: contentWidth * 0.08 },
    { label: "Estado", w: contentWidth * 0.15 },
    { label: "Evidencia", w: contentWidth * 0.28 },
    { label: "Relevancia", w: contentWidth * 0.21 },
  ];
  const headerH = 8.2 * factor;
  const lineH = 3.5 * factor;
  const maxLinesByCol = [3, 2, 2, 3, 3];

  const drawHeader = () => {
    doc.setFillColor(15, 118, 110);
    doc.rect(marginX, y, contentWidth, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsHeader);
    doc.setTextColor(255, 255, 255);
    let x = marginX + pad;
    cols.forEach((c) => {
      const labelLines = doc.splitTextToSize(c.label, c.w - pad * 1.2).slice(0, 1);
      doc.text(labelLines, x, y + 5.4 * factor);
      x += c.w;
    });
    y += headerH;
  };

  drawHeader();

  const ordered = [...data.items].sort((a, b) => {
    const rank = (s: string) =>
      s === "pending_closure" ? 0 : s === "limited_technical" ? 1 : s === "positive" ? 2 : 3;
    return rank(a.status) - rank(b.status);
  });

  const noteForRow = (row: (typeof ordered)[number]): string => {
    if (row.status === "pending_closure") return "Sin mención en el informe";
    if (row.status === "limited_technical") {
      return row.whyItMatters || "Evaluación limitada por técnica";
    }
    return row.whyItMatters || "—";
  };

  const maxRows = 10;
  for (let i = 0; i < Math.min(ordered.length, maxRows); i++) {
    const row = ordered[i];
    const evidence =
      row.status === "limited_technical"
        ? row.technicalReason || ""
        : row.evidence || row.suggestedInsert || "";

    const cells = [
      sanitizePdfText(row.sign || ""),
      sanitizePdfText(row.laterality || "—"),
      sanitizePdfText(negativityStatusLabel(row.status)),
      sanitizePdfText(evidence || "—"),
      sanitizePdfText(noteForRow(row)),
    ];

    const wrapped = cells.map((t, ci) => {
      const maxW = Math.max(4 * factor, cols[ci].w - pad * 2);
      if (ci === 0 || ci === 2) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      doc.setFontSize(ci === 0 || ci === 2 ? fsBodyEm : fsBody);
      return doc.splitTextToSize(t, maxW).slice(0, maxLinesByCol[ci]);
    });
    const rowH = Math.max(
      8.0 * factor,
      Math.max(...wrapped.map((w) => w.length)) * lineH + 2.8 * factor
    );

    if (y + rowH > pageBottom - 24 * factor) break;

    if (i % 2 === 1) {
      doc.setFillColor(softFill[0], softFill[1], softFill[2]);
      doc.rect(marginX, y, contentWidth, rowH, "F");
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    let gx = marginX;
    for (let ci = 0; ci < cols.length - 1; ci++) {
      gx += cols[ci].w;
      doc.line(gx, y, gx, y + rowH);
    }

    wrapped.forEach((lines, ci) => {
      const colLeft = marginX + cols.slice(0, ci).reduce((a, c) => a + c.w, 0);
      if (ci === 2) {
        doc.setFont("helvetica", "bold");
        if (row.status === "pending_closure") doc.setTextColor(180, 83, 9);
        else if (row.status === "limited_technical") doc.setTextColor(217, 119, 6);
        else if (row.status === "positive") doc.setTextColor(220, 38, 38);
        else doc.setTextColor(22, 101, 52);
      } else if (ci === 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
      }
      doc.setFontSize(ci === 0 || ci === 2 ? fsBodyEm : fsBody);
      doc.text(lines, colLeft + pad, y + 3.4 * factor);
    });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, y + rowH, marginX + contentWidth, y + rowH);
    y += rowH;
  }

  const gaps = (data.technicalGaps || []).filter(Boolean).slice(0, 3);
  if (gaps.length && y + 14 * factor < pageBottom) {
    y += 3.5 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsFooterLabel);
    doc.setTextColor(217, 119, 6);
    doc.text("LIMITACIONES TECNICAS", marginX, y);
    y += 4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsFooterBody);
    doc.setTextColor(71, 85, 105);
    gaps.forEach((g) => {
      const lines = doc.splitTextToSize(sanitizePdfText(`• ${g}`), contentWidth).slice(0, 2);
      if (y + lines.length * 3.5 * factor > pageBottom - 12 * factor) return;
      doc.text(lines, marginX, y);
      y += lines.length * 3.5 * factor;
    });
  }

  const synopsis = sanitizePdfText(
    data.discardedSynopsis ||
      buildDiscardedFindingsSynopsis(data.items, data.recommendation) ||
      ""
  );
  if (synopsis && y + 14 * factor < pageBottom) {
    y += 4 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsFooterLabel);
    doc.setTextColor(15, 118, 110);
    doc.text("SINOPSIS DE HALLAZGOS DESCARTADOS", marginX, y);
    y += 4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsFooterBody);
    doc.setTextColor(51, 65, 85);
    const remaining = Math.max(2, Math.floor((pageBottom - y) / (3.5 * factor)));
    const lines = doc.splitTextToSize(synopsis, contentWidth).slice(0, Math.min(4, remaining));
    doc.text(lines, marginX, y);
  }
}
