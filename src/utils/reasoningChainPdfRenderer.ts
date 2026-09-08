import { ReasoningChainData } from "../types";
import { reasoningKindLabel, reasoningStatusLabel } from "../lib/reasoningChain";

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

function nodeFill(kind: string): [number, number, number] {
  switch (kind) {
    case "clinical_context":
      return [16, 185, 129];
    case "sought_signs":
      return [14, 165, 233];
    case "key_finding":
      return [139, 92, 246];
    case "associated_signs":
      return [6, 182, 212];
    case "absent_signs":
      return [244, 63, 94];
    case "lab_correlation":
      return [245, 158, 11];
    case "synthesis":
      return [20, 184, 166];
    case "management":
      return [99, 102, 241];
    default:
      return [100, 116, 139];
  }
}

/**
 * Annex: vertical radiological reasoning chain for the PDF.
 */
export function renderReasoningChainAnnexToPDF(
  doc: any,
  chain: ReasoningChainData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!chain || !Array.isArray(chain.nodes) || chain.nodes.length === 0) return;

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const pageBottom = pageHeight - 16 * factor;
  const fsTitle = 13 * factor;
  const fsBanner = 10.5 * factor;
  const fsMeta = 9 * factor;
  const fsBody = 9.2 * factor;
  const lineBody = 4.3 * factor;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 18 * factor;
  };

  doc.addPage();
  let y = 20 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsTitle);
  doc.setTextColor(15, 23, 42);
  doc.text("ANEXO: CADENA DE RAZONAMIENTO RADIOLOGICO", marginX, y);
  y += 5.5 * factor;

  doc.setDrawColor(139, 92, 246);
  doc.setLineWidth(0.9);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7 * factor;

  const bannerTitle = sanitizePdfText(
    `${chain.workingDiagnosis || chain.title}${chain.certaintyLabel ? `  |  Certeza: ${chain.certaintyLabel}` : ""}`
  );
  const bannerLines = doc.splitTextToSize(bannerTitle, contentWidth - 14 * factor);
  const contextLines = chain.clinicalContext
    ? doc.splitTextToSize(sanitizePdfText(chain.clinicalContext), contentWidth - 14 * factor)
    : [];
  const bannerH =
    Math.max(18 * factor, bannerLines.length * 5 * factor + contextLines.length * 4 * factor + 12 * factor);

  doc.setFillColor(245, 243, 255);
  doc.setDrawColor(196, 181, 253);
  doc.roundedRect(marginX, y, contentWidth, bannerH, 2, 2, "FD");
  doc.setFillColor(139, 92, 246);
  doc.rect(marginX, y, 3.5 * factor, bannerH, "F");

  doc.setTextColor(76, 29, 149);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fsBanner);
  let ty = y + 6 * factor;
  bannerLines.forEach((line: string) => {
    doc.text(line, marginX + 7 * factor, ty);
    ty += 5 * factor;
  });
  if (contextLines.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(71, 85, 105);
    contextLines.forEach((line: string) => {
      doc.text(line, marginX + 7 * factor, ty);
      ty += 4 * factor;
    });
  }
  y += bannerH + 6 * factor;

  const leftGutter = 10 * factor;
  const cardX = marginX + leftGutter;
  const cardW = contentWidth - leftGutter;

  chain.nodes.forEach((node, idx) => {
    const fill = nodeFill(node.kind);
    const title = sanitizePdfText(`${idx + 1}. ${node.title || reasoningKindLabel(node.kind)}`);
    const summary = sanitizePdfText(node.summary || "");
    const titleLines = doc.splitTextToSize(title, cardW - 12 * factor);
    const summaryLines = summary ? doc.splitTextToSize(summary, cardW - 12 * factor) : [];
    const itemBlocks: { lines: string[]; h: number }[] = [];
    (node.items || []).forEach((it) => {
      const head = sanitizePdfText(
        `${it.label} [${reasoningStatusLabel(it.status)}]${it.significance ? ` — ${it.significance}` : ""}`
      );
      const lines = doc.splitTextToSize(`• ${head}`, cardW - 14 * factor);
      itemBlocks.push({ lines, h: lines.length * lineBody });
    });
    const itemsH = itemBlocks.reduce((acc, b) => acc + b.h + 1.2 * factor, 0);
    const metaBits: string[] = [];
    if (node.clinicalLink) metaBits.push(`Clinica: ${node.clinicalLink}`);
    if (node.labLink) metaBits.push(`Lab: ${node.labLink}`);
    const metaLines = metaBits.length
      ? doc.splitTextToSize(sanitizePdfText(metaBits.join("  |  ")), cardW - 12 * factor)
      : [];
    const cardH =
      8 * factor +
      titleLines.length * 4.6 * factor +
      summaryLines.length * lineBody +
      metaLines.length * 3.8 * factor +
      itemsH +
      4 * factor;

    ensureSpace(cardH + 4 * factor);

    // connector dot
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.circle(marginX + 4 * factor, y + 6 * factor, 2.2 * factor, "F");
    if (idx < chain.nodes.length - 1) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(marginX + 4 * factor, y + 8.5 * factor, marginX + 4 * factor, y + cardH + 2 * factor);
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, y, cardW, cardH, 1.5, 1.5, "FD");
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(cardX, y, 2.8 * factor, cardH, "F");

    let cy = y + 5.5 * factor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsBody);
    doc.setTextColor(15, 23, 42);
    titleLines.forEach((line: string) => {
      doc.text(line, cardX + 6 * factor, cy);
      cy += 4.6 * factor;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fsMeta);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(`${reasoningKindLabel(node.kind)} | ${reasoningStatusLabel(node.status)}`),
      cardX + 6 * factor,
      cy
    );
    cy += 4.2 * factor;

    doc.setTextColor(51, 65, 85);
    summaryLines.forEach((line: string) => {
      doc.text(line, cardX + 6 * factor, cy);
      cy += lineBody;
    });

    metaLines.forEach((line: string) => {
      doc.setTextColor(71, 85, 105);
      doc.text(line, cardX + 6 * factor, cy);
      cy += 3.8 * factor;
    });

    itemBlocks.forEach((block) => {
      doc.setTextColor(30, 41, 59);
      block.lines.forEach((line: string) => {
        doc.text(line, cardX + 7 * factor, cy);
        cy += lineBody;
      });
      cy += 1.2 * factor;
    });

    y += cardH + 3.5 * factor;
  });

  if (chain.discardedDifferentials?.length) {
    const discLines: string[] = [];
    chain.discardedDifferentials.forEach((d) => {
      discLines.push(
        ...doc.splitTextToSize(
          sanitizePdfText(`X ${d.name}${d.reason ? ` — ${d.reason}` : ""}`),
          contentWidth - 12 * factor
        )
      );
    });
    const boxH = 10 * factor + discLines.length * lineBody;
    ensureSpace(boxH + 4 * factor);
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(marginX, y, contentWidth, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fsMeta);
    doc.setTextColor(159, 18, 57);
    doc.text("DIFERENCIALES DESCARTADOS", marginX + 6 * factor, y + 5.5 * factor);
    let dy = y + 10 * factor;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    discLines.forEach((line: string) => {
      doc.text(line, marginX + 6 * factor, dy);
      dy += lineBody;
    });
    y += boxH + 4 * factor;
  }

  if (chain.synthesis || chain.managementSuggestion) {
    const synth = chain.synthesis
      ? doc.splitTextToSize(sanitizePdfText(`Sintesis: ${chain.synthesis}`), contentWidth - 12 * factor)
      : [];
    const mgmt = chain.managementSuggestion
      ? doc.splitTextToSize(
          sanitizePdfText(`Conducta: ${chain.managementSuggestion}`),
          contentWidth - 12 * factor
        )
      : [];
    const boxH = 8 * factor + (synth.length + mgmt.length) * lineBody + 4 * factor;
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
