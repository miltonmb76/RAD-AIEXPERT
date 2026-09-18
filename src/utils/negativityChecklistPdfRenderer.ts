import { NegativityChecklistData } from "../types";
import {
  buildDiscardedFindingsSynopsis,
  negativityStatusLabel,
} from "../lib/negativityChecklist";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * Annex: Checklist de negatividad dirigida.
 * Typography aligned with suite fichas (~8.2–8.4 pt).
 * Cell text wraps fully (no hard truncation); continues on a new page if needed.
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
  const accent: [number, number, number] = [13, 148, 136];
  const softFill: [number, number, number] = [240, 253, 250];
  const softBorder: [number, number, number] = [153, 246, 228];
  const pad = 1.6 * factor;
  const topY = 22 * factor;

  const fsTitle = 12.5 * factor;
  const fsBanner = 9.5 * factor;
  const fsMainFindings = 8.4 * factor;
  const fsHeader = 8.4 * factor;
  const fsBody = 8.2 * factor;
  const fsBodyEm = 8.4 * factor;
  const fsFooterLabel = 8.8 * factor;
  const fsFooterBody = 8.2 * factor;

  const cols = [
    { label: "Signo / estructura", w: contentWidth * 0.28 },
    { label: "Lado", w: contentWidth * 0.08 },
    { label: "Estado", w: contentWidth * 0.15 },
    { label: "Evidencia", w: contentWidth * 0.28 },
    { label: "Relevancia", w: contentWidth * 0.21 },
  ];
  const headerH = 8.2 * factor;
  const lineH = 3.55 * factor;
  const requestedFocus = sanitizePdfText(String(data.requestedFocus || "").trim());

  let y = topY;

  const startPageChrome = (continued: boolean) => {
    doc.addPage();
    y = topY;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsTitle);
    doc.setTextColor(15, 23, 42);
    const baseTitle = continued
      ? "ANEXO: CHECKLIST DE NEGATIVIDAD DIRIGIDA (cont.)"
      : "ANEXO: CHECKLIST DE NEGATIVIDAD DIRIGIDA";
    const pageTitle = requestedFocus ? `${baseTitle} — ${requestedFocus}` : baseTitle;
    const pageTitleLines = doc.splitTextToSize(
      pageTitle,
      pageWidth - marginX * 2
    );
    pageTitleLines.forEach((line: string) => {
      doc.text(line, marginX, y);
      y += 4.8 * factor;
    });

    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.8);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5 * factor;
  };

  const drawTableHeader = () => {
    doc.setFillColor(15, 118, 110);
    doc.rect(marginX, y, contentWidth, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsHeader);
    doc.setTextColor(255, 255, 255);
    let x = marginX + pad;
    cols.forEach((c) => {
      const labelLines = doc.splitTextToSize(c.label, c.w - pad * 1.2);
      doc.text(labelLines[0] || c.label, x, y + 5.4 * factor);
      x += c.w;
    });
    y += headerH;
  };

  const ensureSpace = (needed: number, continuedHeader: boolean) => {
    if (y + needed <= pageBottom) return;
    startPageChrome(true);
    if (continuedHeader) drawTableHeader();
  };

  startPageChrome(false);

  const studyParts = [data.protocolName, data.studyRegion]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
  const studyName = sanitizePdfText(studyParts.join(" — ") || "Estudio");
  const mainFindingLabels = data.items
    .filter((item) => item.status === "positive")
    .map((item) => {
      const side = item.laterality ? ` (${item.laterality})` : "";
      return `${item.sign}${side}`.trim();
    })
    .filter(Boolean);
  const mainFindings = mainFindingLabels.length
    ? sanitizePdfText(`Hallazgos principales: ${mainFindingLabels.join("; ")}.`)
    : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  const studyLines = doc.splitTextToSize(studyName, contentWidth - 14 * factor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsMainFindings);
  const findingLines = mainFindings
    ? doc.splitTextToSize(mainFindings, contentWidth - 14 * factor)
    : [];
  const bannerH = Math.max(
    12 * factor,
    studyLines.length * 4.4 * factor +
      findingLines.length * 3.8 * factor +
      6 * factor
  );
  doc.setFillColor(softFill[0], softFill[1], softFill[2]);
  doc.setDrawColor(softBorder[0], softBorder[1], softBorder[2]);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 1.8, 1.8, "FD");
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(marginX, y, 2.8 * factor, bannerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  doc.setTextColor(15, 118, 110);
  let ty = y + 5.2 * factor;
  studyLines.forEach((line: string) => {
    doc.text(line, marginX + 6 * factor, ty);
    ty += 4.4 * factor;
  });
  if (findingLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMainFindings);
    doc.setTextColor(51, 65, 85);
    findingLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, ty);
      ty += 3.8 * factor;
    });
  }
  y += bannerH + 3.5 * factor;

  drawTableHeader();

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

  ordered.forEach((row, i) => {
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

    // Full wrap — no .slice() truncation so phrases stay complete
    const wrapped = cells.map((t, ci) => {
      const maxW = Math.max(4 * factor, cols[ci].w - pad * 2);
      if (ci === 0 || ci === 2) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      doc.setFontSize(ci === 0 || ci === 2 ? fsBodyEm : fsBody);
      return doc.splitTextToSize(t, maxW) as string[];
    });
    const rowH = Math.max(
      8.0 * factor,
      Math.max(...wrapped.map((w) => w.length), 1) * lineH + 2.8 * factor
    );

    ensureSpace(rowH + 1 * factor, true);

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
  });

  const gaps = (data.technicalGaps || []).filter(Boolean);
  if (gaps.length) {
    ensureSpace(16 * factor, false);
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
      const lines = doc.splitTextToSize(sanitizePdfText(`• ${g}`), contentWidth) as string[];
      ensureSpace(lines.length * 3.5 * factor + 2 * factor, false);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fsFooterBody);
      doc.setTextColor(71, 85, 105);
      doc.text(lines, marginX, y);
      y += lines.length * 3.5 * factor;
    });
  }

  const synopsis = sanitizePdfText(
    data.discardedSynopsis ||
      buildDiscardedFindingsSynopsis(data.items, data.recommendation) ||
      ""
  );
  if (synopsis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsFooterBody);
    const lines = doc.splitTextToSize(synopsis, contentWidth) as string[];
    ensureSpace(lines.length * 3.5 * factor + 12 * factor, false);
    y += 4 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsFooterLabel);
    doc.setTextColor(15, 118, 110);
    doc.text("SINOPSIS DE HALLAZGOS DESCARTADOS", marginX, y);
    y += 4 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsFooterBody);
    doc.setTextColor(51, 65, 85);
    doc.text(lines, marginX, y);
  }
}
