import { DifferentialTreeData } from "../types";
import { differentialStatusLabel } from "../lib/differentialTree";

function sanitizePdfText(input: string): string {
  return (input || "")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/–|—/g, "-")
    .replace(/[^\x00-\x7F]/g, (ch) => {
      try {
        return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      } catch {
        return "?";
      }
    });
}

function statusFill(status: string): [number, number, number] {
  if (status === "leading") return [16, 185, 129];
  if (status === "pruned") return [100, 116, 139];
  return [245, 158, 11];
}

/**
 * Annex: differential diagnosis prune tree for the PDF.
 */
export function renderDifferentialTreeAnnexToPDF(
  doc: any,
  tree: DifferentialTreeData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!tree || !Array.isArray(tree.branches) || tree.branches.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 16 * factor;
  const fsTitle = 13 * factor;
  const fsBanner = 10.5 * factor;
  const fsMeta = 9 * factor;
  const fsBody = 9.2 * factor;
  const lineBody = 4.3 * factor;

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
  doc.text("ANEXO: ARBOL DE DIFERENCIALES CON PODA", marginX, y);
  y += 5.5 * factor;

  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  const q = sanitizePdfText(tree.clinicalQuestion || tree.title);
  const lead = sanitizePdfText(
    `Diagnostico mas probable: ${tree.leadingDiagnosis || ""}${
      tree.certaintyLabel ? `  |  Certeza: ${tree.certaintyLabel}` : ""
    }`
  );
  const qLines = doc.splitTextToSize(q, contentWidth - 14 * factor);
  const leadLines = doc.splitTextToSize(lead, contentWidth - 14 * factor);
  const bannerH = Math.max(16 * factor, (qLines.length + leadLines.length) * 4.8 * factor + 10 * factor);

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(253, 186, 116);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(249, 115, 22);
  doc.rect(marginX, y, 3.5 * factor, bannerH, "F");

  let ty = y + 6 * factor;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  doc.setTextColor(154, 52, 18);
  qLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 4.8 * factor;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fsMeta);
  doc.setTextColor(15, 118, 110);
  leadLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 4.5 * factor;
  });
  y += bannerH + 6 * factor;

  const ordered = [
    ...tree.branches.filter((b) => b.status === "leading"),
    ...tree.branches.filter((b) => b.status === "active"),
    ...tree.branches.filter((b) => b.status === "pruned"),
  ];

  ordered.forEach((branch) => {
    const fill = statusFill(branch.status);
    const title = sanitizePdfText(`${branch.name}  [${differentialStatusLabel(branch.status)}]`);
    const summary = sanitizePdfText(branch.summary || "");
    const titleLines = doc.splitTextToSize(title, contentWidth - 12 * factor);
    const summaryLines = summary ? doc.splitTextToSize(summary, contentWidth - 12 * factor) : [];

    const forLines: string[] = [];
    branch.criteriaFor.forEach((c) => {
      forLines.push(
        ...doc.splitTextToSize(
          sanitizePdfText(`+ ${c.label}${c.evidence ? ` ("${c.evidence}")` : ""}`),
          contentWidth - 14 * factor
        )
      );
    });
    const againstLines: string[] = [];
    branch.criteriaAgainst.forEach((c) => {
      againstLines.push(
        ...doc.splitTextToSize(
          sanitizePdfText(`- ${c.label}${c.evidence ? ` ("${c.evidence}")` : ""}`),
          contentWidth - 14 * factor
        )
      );
    });
    const pruneLines =
      branch.status === "pruned" && branch.pruneReason
        ? doc.splitTextToSize(sanitizePdfText(`Poda: ${branch.pruneReason}`), contentWidth - 14 * factor)
        : [];

    const cardH =
      7 * factor +
      titleLines.length * 4.6 * factor +
      summaryLines.length * lineBody +
      (forLines.length ? 4 * factor + forLines.length * lineBody : 0) +
      (againstLines.length ? 4 * factor + againstLines.length * lineBody : 0) +
      pruneLines.length * lineBody +
      5 * factor;

    ensureSpace(cardH + 3 * factor);

    const bg =
      branch.status === "leading"
        ? [236, 253, 245]
        : branch.status === "pruned"
          ? [248, 250, 252]
          : [255, 251, 235];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, cardH, 1.5, 1.5, "FD");
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(marginX, y, 2.8 * factor, cardH, "F");

    let cy = y + 5.5 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.setTextColor(branch.status === "pruned" ? 100 : 15, branch.status === "pruned" ? 116 : 23, branch.status === "pruned" ? 139 : 42);
    titleLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += 4.6 * factor;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(51, 65, 85);
    summaryLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, cy);
      cy += lineBody;
    });

    if (forLines.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(4, 120, 87);
      doc.text("A favor", marginX + 6 * factor, cy);
      cy += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      forLines.forEach((line: string) => {
        doc.text(line, marginX + 7 * factor, cy);
        cy += lineBody;
      });
    }

    if (againstLines.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(190, 18, 60);
      doc.text("En contra", marginX + 6 * factor, cy);
      cy += 4 * factor;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      againstLines.forEach((line: string) => {
        doc.text(line, marginX + 7 * factor, cy);
        cy += lineBody;
      });
    }

    if (pruneLines.length) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(71, 85, 105);
      pruneLines.forEach((line: string) => {
        doc.text(line, marginX + 6 * factor, cy);
        cy += lineBody;
      });
    }

    y += cardH + 3.5 * factor;
  });

  if (tree.pruningNarrative) {
    const lines = doc.splitTextToSize(
      sanitizePdfText(`Narrativa de poda: ${tree.pruningNarrative}`),
      contentWidth - 12 * factor
    );
    const boxH = 8 * factor + lines.length * lineBody;
    ensureSpace(boxH + 3 * factor);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
    let sy = y + 5.5 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(51, 65, 85);
    lines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, sy);
      sy += lineBody;
    });
    y += boxH + 4 * factor;
  }

  if (tree.synthesis || tree.managementSuggestion) {
    const synth = tree.synthesis
      ? doc.splitTextToSize(sanitizePdfText(`Sintesis: ${tree.synthesis}`), contentWidth - 12 * factor)
      : [];
    const mgmt = tree.managementSuggestion
      ? doc.splitTextToSize(
          sanitizePdfText(`Conducta: ${tree.managementSuggestion}`),
          contentWidth - 12 * factor
        )
      : [];
    const boxH = 8 * factor + (synth.length + mgmt.length) * lineBody + 3 * factor;
    ensureSpace(boxH);
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
    let sy = y + 6 * factor;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(15, 118, 110);
    synth.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, sy);
      sy += lineBody;
    });
    doc.setTextColor(67, 56, 202);
    mgmt.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, sy);
      sy += lineBody;
    });
  }
}
