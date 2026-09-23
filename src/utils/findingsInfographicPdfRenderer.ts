import { FindingsInfographicData } from "../types";
import { buildInfographicScene } from "../lib/findingsInfographic";
import { sanitizePdfText } from "./sanitizePdfText";

function wrapPdfText(
  doc: any,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const lines = doc.splitTextToSize(sanitizePdfText(text || ""), maxWidth) as string[];
  if (lines.length <= maxLines) return lines;
  const sliced = lines.slice(0, maxLines);
  const last = sliced[maxLines - 1] || "";
  sliced[maxLines - 1] = last.length > 2 ? `${last.slice(0, -1)}.` : last;
  return sliced;
}

/**
 * Vector annex: diagnostic-justification infographic (findings only).
 */
export function renderFindingsInfographicAnnexToPDF(
  doc: any,
  data: FindingsInfographicData | null,
  options: {
    marginX: number;
    pageWidth: number;
    pageHeight: number;
    contentWidth: number;
    factor: number;
  }
) {
  if (!data || !Array.isArray(data.nodes) || !data.nodes.some((n) => n.label?.trim())) {
    return;
  }

  const { marginX, pageWidth, pageHeight, contentWidth, factor } = options;
  const scene = buildInfographicScene(data);

  doc.addPage();

  // Map scene coords (1000 x H) onto page content area below running header.
  const topSafe = 24 * factor;
  const bottomSafe = 14 * factor;
  const availH = pageHeight - topSafe - bottomSafe;
  const scale = Math.min(contentWidth / scene.width, availH / scene.height);
  const drawW = scene.width * scale;
  const drawH = scene.height * scale;
  const ox = marginX + (contentWidth - drawW) / 2;
  const oy = topSafe + Math.max(0, (availH - drawH) * 0.08);

  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + y * scale;
  const ss = (v: number) => v * scale;

  // Background panel
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(ox - 2, oy - 2, drawW + 4, drawH + 4, 3, 3, "F");

  // Accent wash
  doc.setFillColor(19, 78, 74);
  doc.setGState?.(doc.GState?.({ opacity: 0.25 }));
  // Fallback without GState: draw subtle rect
  doc.setFillColor(20, 40, 48);
  doc.roundedRect(ox, oy, drawW, drawH, 2.5, 2.5, "F");

  // Header label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8 * factor);
  doc.setTextColor(153, 246, 228);
  doc.text("JUSTIFICACION DIAGNOSTICA", sx(40), sy(38));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(100, 116, 139);
  const modeLabel =
    scene.layout === "convergence"
      ? "Convergencia"
      : scene.layout === "constellation"
        ? "Constelacion"
        : "Cascada";
  const rightMeta = sanitizePdfText(
    `${modeLabel}${scene.studyRegion ? `  |  ${scene.studyRegion}` : ""}`
  );
  doc.text(rightMeta, sx(scene.width - 40), sy(38), { align: "right" });

  // Edges (curves approximated as polylines)
  scene.edges.forEach((e) => {
    doc.setDrawColor(94, 234, 212);
    doc.setLineWidth(0.7 * factor);
    const steps = 12;
    let prevX = sx(e.x1);
    let prevY = sy(e.y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * e.x1 + 2 * mt * t * e.cx + t * t * e.x2;
      const y = mt * mt * e.y1 + 2 * mt * t * e.cy + t * t * e.y2;
      const nx = sx(x);
      const ny = sy(y);
      doc.line(prevX, prevY, nx, ny);
      prevX = nx;
      prevY = ny;
    }
    // Arrow head
    const angle = Math.atan2(e.y2 - e.cy, e.x2 - e.cx);
    const size = ss(11);
    const ax = sx(e.x2);
    const ay = sy(e.y2);
    const p1x = ax - size * Math.cos(angle - Math.PI / 7);
    const p1y = ay - size * Math.sin(angle - Math.PI / 7);
    const p2x = ax - size * Math.cos(angle + Math.PI / 7);
    const p2y = ay - size * Math.sin(angle + Math.PI / 7);
    doc.setFillColor(94, 234, 212);
    doc.triangle(ax, ay, p1x, p1y, p2x, p2y, "F");
  });

  // Boxes
  scene.boxes.forEach((b) => {
    const x = sx(b.x);
    const y = sy(b.y);
    const w = ss(b.w);
    const h = ss(b.h);
    const r = ss(10);

    if (b.kind === "diagnosis") {
      doc.setFillColor(13, 148, 136);
      doc.setDrawColor(94, 234, 212);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, y, w, h, r, r, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7 * factor);
      doc.setTextColor(204, 251, 241);
      doc.text("DIAGNOSTICO", x + w / 2, y + ss(22), { align: "center" });

      const labelLines = wrapPdfText(doc, b.label, w - ss(24), 2);
      doc.setFontSize(11 * factor);
      doc.setTextColor(240, 253, 250);
      let ty = y + ss(44);
      labelLines.forEach((line: string) => {
        doc.text(line, x + w / 2, ty, { align: "center" });
        ty += ss(16);
      });
    } else {
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(b.weight === "primary" ? 45 : 51, b.weight === "primary" ? 212 : 65, b.weight === "primary" ? 191 : 85);
      doc.setLineWidth(b.weight === "primary" ? 0.8 : 0.45);
      doc.roundedRect(x, y, w, h, r * 0.8, r * 0.8, "FD");

      // Left accent
      doc.setFillColor(20, 184, 166);
      doc.rect(x, y, ss(5), h, "F");

      const labelLines = wrapPdfText(doc, b.label, w - ss(22), 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5 * factor);
      doc.setTextColor(241, 245, 249);
      let ty = y + ss(22);
      labelLines.forEach((line: string) => {
        doc.text(line, x + w / 2, ty, { align: "center" });
        ty += ss(12);
      });

      if (b.detail) {
        const detailLines = wrapPdfText(doc, b.detail, w - ss(22), 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7 * factor);
        doc.setTextColor(148, 163, 184);
        let dy = y + h - ss(14) - (detailLines.length - 1) * ss(10);
        detailLines.forEach((line: string) => {
          doc.text(line, x + w / 2, dy, { align: "center" });
          dy += ss(10);
        });
      }
    }
  });

  // Silence unused pageWidth lint-ish
  void pageWidth;
}
