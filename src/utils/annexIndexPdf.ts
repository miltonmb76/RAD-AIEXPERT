import type { jsPDF } from "jspdf";
import { sanitizePdfText } from "./sanitizePdfText";

export type AnnexIndexEntry = {
  title: string;
  /** 1-based page number where the annex begins (before index insertion). */
  pageNumber: number;
};

export type AnnexTracker = {
  entries: AnnexIndexEntry[];
  markStart: () => void;
  markEnd: (title: string) => void;
  wrap: (title: string, fn: () => void | Promise<void>) => Promise<void>;
};

/** Track annex start pages: call wrap() around each annex renderer. */
export function createAnnexTracker(doc: jsPDF): AnnexTracker {
  let before = 0;
  const entries: AnnexIndexEntry[] = [];
  return {
    entries,
    markStart() {
      before = doc.getNumberOfPages();
    },
    markEnd(title: string) {
      const after = doc.getNumberOfPages();
      const label = sanitizePdfText(String(title || "").trim());
      if (!label || after <= before) return;
      // Avoid duplicate titles pointing at the same page (multi-page annex continuation)
      if (
        entries.some(
          (e) => e.pageNumber === before + 1 && e.title === label
        )
      ) {
        return;
      }
      entries.push({ title: label, pageNumber: before + 1 });
    },
    async wrap(title: string, fn: () => void | Promise<void>) {
      this.markStart();
      await fn();
      this.markEnd(title);
    },
  };
}

/**
 * Insert a clickable annex index page at `insertAtPage` (1-based),
 * shifting subsequent pages — then rewrite entry page numbers (+1).
 */
export function finalizeAnnexIndex(
  doc: jsPDF,
  opts: {
    enabled: boolean;
    insertAtPage: number | null;
    entries: AnnexIndexEntry[];
    marginX: number;
    pageWidth: number;
    factor?: number;
    studyLabel?: string;
  }
): boolean {
  const {
    enabled,
    insertAtPage,
    entries,
    marginX,
    pageWidth,
    studyLabel,
  } = opts;
  const factor = opts.factor || 1;

  if (!enabled || !entries.length || !insertAtPage || insertAtPage < 1) {
    return false;
  }

  const totalPages = doc.getNumberOfPages();
  if (insertAtPage > totalPages + 1) return false;

  // Blank page before the first annex (shifts all annex pages +1)
  doc.insertPage(insertAtPage);
  for (const e of entries) {
    e.pageNumber += 1;
  }

  doc.setPage(insertAtPage);

  const contentWidth = pageWidth - marginX * 2;
  let y = 22 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text("INDICE DE ANEXOS", marginX, y);
  y += 5 * factor;

  doc.setDrawColor(217, 119, 6); // amber
  doc.setLineWidth(0.7);
  doc.line(marginX, y, marginX + 42 * factor, y);
  y += 6 * factor;

  if (studyLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5 * factor);
    doc.setTextColor(100, 116, 139);
    const sub = sanitizePdfText(String(studyLabel));
    const lines = doc.splitTextToSize(sub, contentWidth) as string[];
    lines.slice(0, 2).forEach((line) => {
      doc.text(line, marginX, y);
      y += 4 * factor;
    });
    y += 2 * factor;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8 * factor);
  doc.setTextColor(120, 113, 108);
  doc.text(
    "Pulse un anexo para ir a su pagina (visor PDF digital).",
    marginX,
    y
  );
  y += 8 * factor;

  const rowH = 7.2 * factor;
  const pageColW = 18 * factor;
  const titleW = contentWidth - pageColW - 4 * factor;

  entries.forEach((entry, i) => {
    if (y > doc.internal.pageSize.getHeight() - 18 * factor) {
      // Rare: too many annexes for one index page — stop listing
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8 * factor);
      doc.setTextColor(148, 163, 184);
      doc.text("…", marginX, y);
      return;
    }

    const n = i + 1;
    const title = sanitizePdfText(entry.title);
    const titleLines = (doc.splitTextToSize(`${n}.  ${title}`, titleW) as string[]).slice(
      0,
      2
    );
    const blockH = Math.max(rowH, titleLines.length * 4.2 * factor + 2 * factor);

    // Subtle row wash
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 249);
      doc.roundedRect(marginX - 1, y - 3.5 * factor, contentWidth + 2, blockH, 1, 1, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10 * factor);
    doc.setTextColor(30, 64, 175); // indigo link
    let ty = y;
    titleLines.forEach((line) => {
      doc.textWithLink(line, marginX, ty, { pageNumber: entry.pageNumber });
      ty += 4.2 * factor;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5 * factor);
    doc.setTextColor(41, 37, 36);
    const pageLabel = `p. ${entry.pageNumber}`;
    const pageLabelW = doc.getTextWidth(pageLabel);
    doc.textWithLink(pageLabel, marginX + contentWidth - pageLabelW, y, {
      pageNumber: entry.pageNumber,
    });

    // Dotted leader (visual only)
    doc.setFillColor(214, 211, 209);
    const dotsY = y + 0.8 * factor;
    const dotsStart = marginX + doc.getTextWidth(titleLines[0] || "") + 3 * factor;
    const dotsEnd = marginX + contentWidth - pageColW;
    if (dotsEnd > dotsStart + 8) {
      for (let x = dotsStart; x < dotsEnd; x += 2.2 * factor) {
        doc.circle(x, dotsY, 0.25 * factor, "F");
      }
    }

    y += blockH + 1.5 * factor;
  });

  // PDF bookmarks / outline (sidebar in many viewers)
  try {
    const outline = (doc as any).outline;
    if (outline && typeof outline.add === "function") {
      const root = outline.add(null, "Anexos", { pageNumber: insertAtPage });
      entries.forEach((e) => {
        outline.add(root, e.title, { pageNumber: e.pageNumber });
      });
    }
  } catch {
    /* outline optional */
  }

  return true;
}
