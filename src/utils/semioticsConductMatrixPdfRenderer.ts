import { SemioticsConductMatrixData } from "../types";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * Annex: semiology → conduct decision matrix for the PDF.
 * Larger type + roomy cells; no footnote disclaimer box.
 */
export function renderSemioticsConductMatrixAnnexToPDF(
  doc: any,
  matrix: SemioticsConductMatrixData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!matrix || !Array.isArray(matrix.rows) || matrix.rows.length === 0) return;

  const usableRows = matrix.rows.filter(
    (r) =>
      (r.finding && r.finding.trim()) ||
      (r.signs && r.signs.trim()) ||
      (r.category && r.category.trim()) ||
      (r.conduct && r.conduct.trim())
  );
  if (!usableRows.length) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 14 * factor;

  // Slightly larger type for readability; line height keeps wrapped sentences inside cells.
  const fsTitle = 14.5 * factor;
  const fsBanner = 11 * factor;
  const fsMeta = 9.4 * factor;
  const fsBody = 10 * factor;
  const fsHead = 8.8 * factor;
  const lineBody = 4.8 * factor;
  const cellPadX = 3 * factor;
  const cellPadY = 5.5 * factor;
  const minRowH = 14 * factor;

  // Clear of running header ("ULTRASONIDO… / Pág. …") + separator line (~12–14 mm).
  const topSafe = 26 * factor;
  let y = topSafe;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = topSafe;
  };

  // Fixed annex label — never append/truncate focus here (avoids dangling "(").
  const annexTitle = "MATRIZ SEMIOLOGIA / CONDUCTA";

  doc.addPage();
  y = topSafe;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text(annexTitle, marginX, y);
  y += 7.5 * factor;

  doc.setDrawColor(192, 38, 211);
  doc.setLineWidth(1.1);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8 * factor;

  const focusLine = sanitizePdfText(
    `Enfoque: ${matrix.focusTopic || "Del informe"}${
      matrix.studyRegion ? `  |  Region: ${matrix.studyRegion}` : ""
    }`
  );
  const priorityRaw = String(
    matrix.priorityConduct || matrix.clinicalQuestion || ""
  ).trim();
  const priorityLine = priorityRaw
    ? sanitizePdfText(
        /^conducta prioritaria\s*:/i.test(priorityRaw)
          ? priorityRaw
          : `Conducta prioritaria: ${priorityRaw}`
      )
    : "";
  const focusLines = doc.splitTextToSize(focusLine, contentWidth - 16 * factor);
  const priorityLines = priorityLine
    ? doc.splitTextToSize(priorityLine, contentWidth - 16 * factor)
    : [];
  const bannerH = Math.max(
    16 * factor,
    (focusLines.length + priorityLines.length) * 5.2 * factor + 11 * factor
  );

  doc.setFillColor(253, 244, 255);
  doc.setDrawColor(233, 213, 255);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2.5, 2.5, "FD");
  doc.setFillColor(192, 38, 211);
  doc.rect(marginX, y, 4 * factor, bannerH, "F");

  let ty = y + 6.5 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  doc.setTextColor(112, 26, 117);
  focusLines.forEach((line: string) => {
    doc.text(line, marginX + 8 * factor, ty);
    ty += 5.2 * factor;
  });
  if (priorityLines.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsMeta);
    doc.setTextColor(91, 33, 182);
    priorityLines.forEach((line: string) => {
      doc.text(line, marginX + 8 * factor, ty);
      ty += 4.8 * factor;
    });
  }
  y += bannerH + 7 * factor;

  // Three wide columns (no category — it was too narrow and clipped words).
  const hasAnchor = usableRows.some((r) => r.anchor && r.anchor.trim());
  const cols = hasAnchor
    ? [
        { key: "finding", label: "HALLAZGO", w: 0.26 },
        { key: "signs", label: "SIGNOS / CRITERIOS", w: 0.34 },
        { key: "conduct", label: "CONDUCTA", w: 0.28 },
        { key: "anchor", label: "ANCLA", w: 0.12 },
      ]
    : [
        { key: "finding", label: "HALLAZGO", w: 0.28 },
        { key: "signs", label: "SIGNOS / CRITERIOS", w: 0.38 },
        { key: "conduct", label: "CONDUCTA", w: 0.34 },
      ];

  const colWidths = cols.map((c) => c.w * contentWidth);

  /** Soft-break very long tokens so Helvetica wrap does not clip mid-word awkwardly. */
  const softBreakLongWords = (text: string): string =>
    text.replace(/\S{16,}/g, (token) =>
      token.match(/.{1,14}/g)?.join("\u00AD") || token
    );

  const wrapCell = (raw: string, colW: number): string[] => {
    const text = softBreakLongWords(sanitizePdfText((raw || "").trim() || "-"));
    const maxW = Math.max(18 * factor, colW - cellPadX * 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsBody);
    // Prefer soft-hyphen breaks; fall back to space-inserted chunks.
    let lines = doc.splitTextToSize(text, maxW) as string[];
    if (lines.some((ln: string) => doc.getTextWidth(ln) > maxW + 0.5)) {
      const spaced = sanitizePdfText((raw || "").trim() || "-").replace(
        /\S{14,}/g,
        (token) => token.match(/.{1,12}/g)?.join(" ") || token
      );
      lines = doc.splitTextToSize(spaced, maxW);
    }
    return lines.map((ln: string) => ln.replace(/\u00AD/g, ""));
  };

  const drawHeader = () => {
    const headerH = 10 * factor;
    ensureSpace(headerH + 4 * factor);
    doc.setFillColor(88, 28, 135);
    doc.roundedRect(marginX, y, contentWidth, headerH, 1.5, 1.5, "F");
    let x = marginX;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsHead);
    doc.setTextColor(250, 245, 255);
    cols.forEach((col, i) => {
      doc.text(col.label, x + cellPadX, y + 6.5 * factor);
      x += colWidths[i];
    });
    y += headerH + 2 * factor;
  };

  drawHeader();

  usableRows.forEach((row, idx) => {
    const cellTexts = cols.map((col, colIdx) => {
      const raw =
        col.key === "finding"
          ? row.finding
          : col.key === "signs"
            ? row.signs
            : col.key === "conduct"
              ? row.conduct
              : row.anchor || "";
      return wrapCell(raw, colWidths[colIdx]);
    });
    const maxLines = Math.max(...cellTexts.map((t: string[]) => t.length), 1);
    const rowH = Math.max(minRowH, maxLines * lineBody + cellPadY * 2);

    if (y + rowH > pageBottom) {
      doc.addPage();
      y = topSafe;
      drawHeader();
    }

    const bg =
      idx % 2 === 0 ? ([250, 245, 255] as const) : ([255, 255, 255] as const);
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(216, 180, 254);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, y, contentWidth, rowH, 1.2, 1.2, "FD");

    // Left accent stripe
    doc.setFillColor(192, 38, 211);
    doc.rect(marginX, y, 2 * factor, rowH, "F");

    let x = marginX;
    cellTexts.forEach((lines: string[], i: number) => {
      const isConduct = cols[i].key === "conduct";
      doc.setFont("helvetica", isConduct ? "bold" : "normal");
      doc.setFontSize(fsBody);
      if (isConduct) doc.setTextColor(109, 40, 217);
      else doc.setTextColor(30, 41, 59);

      let cy = y + cellPadY + 1.2 * factor;
      lines.forEach((line: string) => {
        doc.text(line, x + cellPadX, cy);
        cy += lineBody;
      });
      x += colWidths[i];
    });

    y += rowH + 2.2 * factor;
  });
  // Footnote / disclaimer box intentionally omitted.
}
