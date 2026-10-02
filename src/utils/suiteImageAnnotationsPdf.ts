import type { jsPDF } from "jspdf";
import { SuiteImageAnnotation } from "../types";
import { resolveAnnotationGeometry } from "../lib/suiteImageAnnotations";
import { sanitizePdfText } from "./sanitizePdfText";

const ANN_COLORS: Record<
  NonNullable<SuiteImageAnnotation["color"]>,
  { fill: [number, number, number]; border: [number, number, number]; text: [number, number, number] }
> = {
  amber: { fill: [69, 26, 3], border: [251, 191, 36], text: [255, 251, 235] },
  cyan: { fill: [8, 51, 68], border: [34, 211, 238], text: [236, 254, 255] },
  rose: { fill: [76, 5, 25], border: [251, 113, 133], text: [255, 241, 242] },
  emerald: { fill: [6, 46, 32], border: [52, 211, 153], text: [236, 253, 245] },
};

/** Draw editable suite callouts (tip + thin leader + label) over a panel image in jsPDF. */
export function drawSuiteImageAnnotationsOnPdf(
  doc: jsPDF,
  annotations: SuiteImageAnnotation[] | undefined,
  panelLetter: string,
  imgX: number,
  imgY: number,
  imgW: number,
  imgH: number,
  factor: number
) {
  const mine = (annotations || []).filter((a) => a.panelLetter === panelLetter);
  for (const ann of mine) {
    const geo = resolveAnnotationGeometry(ann);
    const tipX = imgX + (imgW * geo.tipX) / 100;
    const tipY = imgY + (imgH * geo.tipY) / 100;
    const labelCx = imgX + (imgW * geo.labelX) / 100;
    const labelCy = imgY + (imgH * geo.labelY) / 100;
    const palette = ANN_COLORS[ann.color || "amber"];
    const label = sanitizePdfText(
      [ann.text, ann.sizeLabel].filter(Boolean).join(" · ")
    ).slice(0, 56);
    if (!label) continue;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2 * factor);
    const padX = 1.4 * factor;
    const textW = Math.min(doc.getTextWidth(label), imgW * 0.55);
    const boxW = textW + padX * 2;
    const boxH = 4.2 * factor;
    let boxX = labelCx - boxW / 2;
    let boxY = labelCy - boxH / 2;
    boxX = Math.max(imgX + 0.6, Math.min(boxX, imgX + imgW - boxW - 0.6));
    boxY = Math.max(imgY + 0.6, Math.min(boxY, imgY + imgH - boxH - 0.6));

    const boxCx = boxX + boxW / 2;
    const boxCy = boxY + boxH / 2;

    const dx = boxCx - tipX;
    const dy = boxCy - tipY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tipR = 0.7 * factor;
    const stopDist = Math.max(0, len - Math.min(boxW, boxH) * 0.42);
    const lineEndX = tipX + ux * stopDist;
    const lineEndY = tipY + uy * stopDist;

    // Thin leader line
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.setLineWidth(0.4);
    doc.line(tipX + ux * tipR, tipY + uy * tipR, lineEndX, lineEndY);

    // Small filled arrowhead at tip (relative line segments)
    const ahLen = 1.55 * factor;
    const ahHalf = 0.7 * factor;
    const baseX = tipX + ux * ahLen;
    const baseY = tipY + uy * ahLen;
    const px = -uy * ahHalf;
    const py = ux * ahHalf;
    doc.setFillColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.lines(
      [
        [baseX + px - tipX, baseY + py - tipY],
        [baseX - px - (baseX + px), baseY - py - (baseY + py)],
        [tipX - (baseX - px), tipY - (baseY - py)],
      ],
      tipX,
      tipY,
      [1, 1],
      "F",
      true
    );

    // Tip marker
    doc.circle(tipX, tipY, 0.45 * factor, "F");

    // Label pill
    doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(boxX, boxY, boxW, boxH, 0.8, 0.8, "FD");

    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.text(label, boxX + padX, boxY + boxH * 0.68, {
      maxWidth: textW + 0.5,
    });
  }
}
