import type { jsPDF } from "jspdf";
import { SuiteImageAnnotation } from "../types";
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

/** Draw editable suite callouts over a panel image rectangle in a jsPDF page. */
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
    const xPct = Math.min(92, Math.max(8, Number(ann.xPct) || 50));
    const yPct = Math.min(92, Math.max(8, Number(ann.yPct) || 50));
    const cx = imgX + (imgW * xPct) / 100;
    const cy = imgY + (imgH * yPct) / 100;
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
    let boxX = cx - boxW / 2;
    let boxY = cy + 1.6 * factor;
    boxX = Math.max(imgX + 0.8, Math.min(boxX, imgX + imgW - boxW - 0.8));
    boxY = Math.max(imgY + 0.8, Math.min(boxY, imgY + imgH - boxH - 0.8));

    doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(boxX, boxY, boxW, boxH, 0.8, 0.8, "FD");

    doc.setFillColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.circle(cx, cy, 0.7 * factor, "F");

    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.text(label, boxX + padX, boxY + boxH * 0.68, {
      maxWidth: textW + 0.5,
    });
  }
}
