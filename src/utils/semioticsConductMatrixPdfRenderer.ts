import { SemioticsConductMatrixData } from "../types";
import { sanitizePdfText } from "./sanitizePdfText";

/**
 * Annex: semiology → conduct decision matrix for the PDF.
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
  const pageBottom = pageHeight - 16 * factor;
  const fsTitle = 13 * factor;
  const fsBanner = 10 * factor;
  const fsMeta = 8.4 * factor;
  const fsBody = 8.6 * factor;
  const fsHead = 7.8 * factor;
  const lineBody = 3.9 * factor;

  let y = 20 * factor;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 18 * factor;
  };

  doc.addPage();
  y = 20 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText(
      (matrix.title || "MATRIZ SEMIOLOGIA → CONDUCTA")
        .replace(/→/g, "->")
        .toUpperCase()
        .slice(0, 64)
    ),
    marginX,
    y
  );
  y += 5.5 * factor;

  doc.setDrawColor(192, 38, 211);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  const focusLine = sanitizePdfText(
    `Enfoque: ${matrix.focusTopic || "Del informe"}${
      matrix.studyRegion ? `  |  Region: ${matrix.studyRegion}` : ""
    }`
  );
  const qLine = matrix.clinicalQuestion
    ? sanitizePdfText(matrix.clinicalQuestion)
    : "";
  const focusLines = doc.splitTextToSize(focusLine, contentWidth - 14 * factor);
  const qLines = qLine
    ? doc.splitTextToSize(qLine, contentWidth - 14 * factor)
    : [];
  const bannerH = Math.max(
    14 * factor,
    (focusLines.length + qLines.length) * 4.6 * factor + 9 * factor
  );

  doc.setFillColor(253, 244, 255);
  doc.setDrawColor(233, 213, 255);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(192, 38, 211);
  doc.rect(marginX, y, 3.5 * factor, bannerH, "F");

  let ty = y + 5.5 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  doc.setTextColor(112, 26, 117);
  focusLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 4.6 * factor;
  });
  if (qLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(91, 33, 182);
    qLines.forEach((line: string) => {
      doc.text(line, marginX + 7 * factor, ty);
      ty += 4.3 * factor;
    });
  }
  y += bannerH + 6 * factor;

  // Column proportions (finding | signs | category | conduct | optional anchor)
  const hasAnchor = usableRows.some((r) => r.anchor && r.anchor.trim());
  const cols = hasAnchor
    ? [
        { key: "finding", label: "HALLAZGO", w: 0.22 },
        { key: "signs", label: "SIGNOS / CRITERIOS", w: 0.28 },
        { key: "category", label: "CATEGORIA", w: 0.14 },
        { key: "conduct", label: "CONDUCTA", w: 0.24 },
        { key: "anchor", label: "ANCLA", w: 0.12 },
      ]
    : [
        { key: "finding", label: "HALLAZGO", w: 0.24 },
        { key: "signs", label: "SIGNOS / CRITERIOS", w: 0.3 },
        { key: "category", label: "CATEGORIA", w: 0.16 },
        { key: "conduct", label: "CONDUCTA", w: 0.3 },
      ];

  const colWidths = cols.map((c) => c.w * contentWidth);
  const pad = 2.2 * factor;

  const drawHeader = () => {
    const headerH = 8 * factor;
    ensureSpace(headerH + 4 * factor);
    doc.setFillColor(88, 28, 135);
    doc.roundedRect(marginX, y, contentWidth, headerH, 1.2, 1.2, "F");
    let x = marginX;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsHead);
    doc.setTextColor(250, 245, 255);
    cols.forEach((col, i) => {
      doc.text(col.label, x + pad, y + 5.2 * factor);
      x += colWidths[i];
    });
    y += headerH + 1.5 * factor;
  };

  drawHeader();

  usableRows.forEach((row, idx) => {
    const cellTexts = cols.map((col, colIdx) => {
      const raw =
        col.key === "finding"
          ? row.finding
          : col.key === "signs"
            ? row.signs
            : col.key === "category"
              ? row.category
              : col.key === "conduct"
                ? row.conduct
                : row.anchor || "";
      return doc.splitTextToSize(
        sanitizePdfText(raw || "-"),
        colWidths[colIdx] - pad * 2
      );
    });
    const maxLines = Math.max(...cellTexts.map((t: string[]) => t.length), 1);
    const rowH = Math.max(10 * factor, maxLines * lineBody + 5 * factor);

    if (y + rowH > pageBottom) {
      doc.addPage();
      y = 18 * factor;
      drawHeader();
    }

    const bg =
      idx % 2 === 0 ? ([250, 245, 255] as const) : ([255, 255, 255] as const);
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(233, 213, 255);
    doc.rect(marginX, y, contentWidth, rowH, "FD");

    // Left accent stripe
    doc.setFillColor(192, 38, 211);
    doc.rect(marginX, y, 1.4 * factor, rowH, "F");

    let x = marginX;
    cellTexts.forEach((lines: string[], i: number) => {
      const isConduct = cols[i].key === "conduct";
      const isCategory = cols[i].key === "category";
      doc.setFont("helvetica", isConduct || isCategory ? "bold" : "normal");
      doc.setFontSize(fsBody);
      if (isConduct) doc.setTextColor(109, 40, 217);
      else if (isCategory) doc.setTextColor(157, 23, 77);
      else doc.setTextColor(30, 41, 59);

      let cy = y + 4.5 * factor;
      lines.forEach((line: string) => {
        doc.text(line, x + pad, cy);
        cy += lineBody;
      });
      x += colWidths[i];
    });

    y += rowH;
  });

  if (matrix.footnote) {
    y += 5 * factor;
    const footLines = doc.splitTextToSize(
      sanitizePdfText(matrix.footnote),
      contentWidth - 12 * factor
    );
    const boxH = 7 * factor + footLines.length * lineBody;
    ensureSpace(boxH);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, y, contentWidth, boxH, 1.5, 1.5, "FD");
    let fy = y + 5 * factor;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(fsMeta);
    doc.setTextColor(71, 85, 105);
    footLines.forEach((line: string) => {
      doc.text(line, marginX + 5 * factor, fy);
      fy += lineBody;
    });
  }
}
