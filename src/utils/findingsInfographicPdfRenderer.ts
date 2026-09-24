import { FindingsInfographicData } from "../types";
import {
  anchorBoxMetrics,
  buildInfographicScene,
  findingBoxMetrics,
  layoutDisplayLabel,
  type InfographicScene,
} from "../lib/findingsInfographic";
import { sanitizePdfText } from "./sanitizePdfText";

function escapeXml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tspans(
  lines: string[],
  x: number,
  startY: number,
  fontSize: number,
  fill: string,
  fontWeight = 700,
  lineHeight = 1.25
): string {
  return lines
    .map((line, i) => {
      const y = startY + i * fontSize * lineHeight;
      return `<text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">${escapeXml(line)}</text>`;
    })
    .join("");
}

/** Same visual language as the on-screen SVG preview. */
export function buildInfographicSvgMarkup(scene: InfographicScene): string {
  const { width, height, boxes, edges, studyRegion, layout, headerLabel } = scene;
  const modeLabel = layoutDisplayLabel(layout);

  const edgePaths = edges
    .map(
      (e) =>
        `<path d="M ${e.x1} ${e.y1} Q ${e.cx} ${e.cy} ${e.x2} ${e.y2}" fill="none" stroke="#5eead4" stroke-width="2.4" opacity="0.75" marker-end="url(#fig-arrow)"/>`
    )
    .join("");

  const boxMarkup = boxes
    .map((b) => {
      if (b.kind === "section") {
        const fill = b.polarity === "ruled_out" ? "#881337" : "#115e59";
        return `<g>
          <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="${fill}" opacity="0.9"/>
          <text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 5}" fill="#ecfeff" font-size="13" font-weight="700" letter-spacing="1.5" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(b.label)}</text>
        </g>`;
      }
      if (b.kind === "diagnosis") {
        const am = anchorBoxMetrics(b.label, b.w);
        const textY = b.y + am.headerH + am.font * 0.85;
        return `<g>
          <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="16" fill="url(#fig-diag)" stroke="#5eead4" stroke-width="1.5"/>
          <text x="${b.x + b.w / 2}" y="${b.y + 24}" fill="#ccfbf1" font-size="12" font-weight="700" letter-spacing="2" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">ANCLA</text>
          ${tspans(am.lines, b.x + b.w / 2, textY, am.font, "#f0fdfa", 700, am.lh)}
        </g>`;
      }
      const metrics = findingBoxMetrics(b.label, b.detail, b.w);
      const accent =
        b.polarity === "ruled_out"
          ? "#fb7185"
          : b.polarity === "criterion"
            ? "#a78bfa"
            : b.weight === "primary"
              ? "#2dd4bf"
              : "#334155";
      const bar =
        b.polarity === "ruled_out"
          ? "#e11d48"
          : b.polarity === "criterion"
            ? "#8b5cf6"
            : "#14b8a6";
      const strokeW = b.weight === "primary" ? 2 : 1.2;
      const labelY = b.y + metrics.padTop + metrics.labelFont * 0.85;
      const detailY =
        labelY +
        Math.max(0, metrics.labelLines.length - 1) * metrics.labelFont * metrics.labelLh +
        (metrics.detailLines.length ? metrics.gap + metrics.detailFont * 0.85 : 0);
      return `<g>
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12" fill="url(#fig-find)" stroke="${accent}" stroke-width="${strokeW}"/>
        <rect x="${b.x}" y="${b.y}" width="5" height="${b.h}" rx="2" fill="${bar}"/>
        ${tspans(metrics.labelLines, b.x + b.w / 2, labelY, metrics.labelFont, "#f1f5f9", 700, metrics.labelLh)}
        ${
          metrics.detailLines.length
            ? tspans(
                metrics.detailLines,
                b.x + b.w / 2,
                detailY,
                metrics.detailFont,
                "#94a3b8",
                400,
                metrics.detailLh
              )
            : ""
        }
      </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="fig-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#134e4a"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="fig-diag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="fig-find" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <marker id="fig-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L6,3 L0,6 Z" fill="#5eead4"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#fig-bg)" rx="18"/>
  <circle cx="140" cy="120" r="110" fill="#14b8a6" opacity="0.07"/>
  <circle cx="${width - 140}" cy="${height - 140}" r="140" fill="#2dd4bf" opacity="0.06"/>
  <text x="48" y="48" fill="#99f6e4" font-size="14" font-weight="700" letter-spacing="2" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(headerLabel)}</text>
  <text x="${width - 48}" y="48" fill="#64748b" font-size="13" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif">${escapeXml(modeLabel)}${studyRegion ? `  ·  ${escapeXml(studyRegion)}` : ""}</text>
  ${edgePaths}
  ${boxMarkup}
</svg>`;
}

async function rasterizeSvgToPng(
  svgMarkup: string,
  pixelWidth: number,
  pixelHeight: number
): Promise<string> {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo rasterizar la infografía SVG."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(800, Math.round(pixelWidth));
    canvas.height = Math.max(600, Math.round(pixelHeight));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible.");
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

/** Fallback vector draw if browser rasterization fails. */
function renderVectorFallback(
  doc: any,
  scene: InfographicScene,
  ox: number,
  oy: number,
  scale: number,
  factor: number
) {
  const sx = (x: number) => ox + x * scale;
  const sy = (y: number) => oy + y * scale;
  const ss = (v: number) => v * scale;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(ox, oy, scene.width * scale, scene.height * scale, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(8, 13 * scale));
  doc.setTextColor(153, 246, 228);
  doc.text(
    sanitizePdfText(scene.headerLabel || "INFOGRAFIA DE HALLAZGOS").slice(0, 48),
    sx(40),
    sy(42)
  );

  scene.edges.forEach((e) => {
    doc.setDrawColor(94, 234, 212);
    doc.setLineWidth(Math.max(0.5, 2.2 * scale));
    const steps = 16;
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
    const angle = Math.atan2(e.y2 - e.cy, e.x2 - e.cx);
    const size = ss(12);
    const ax = sx(e.x2);
    const ay = sy(e.y2);
    doc.setFillColor(94, 234, 212);
    doc.triangle(
      ax,
      ay,
      ax - size * Math.cos(angle - Math.PI / 7),
      ay - size * Math.sin(angle - Math.PI / 7),
      ax - size * Math.cos(angle + Math.PI / 7),
      ay - size * Math.sin(angle + Math.PI / 7),
      "F"
    );
  });

  scene.boxes.forEach((b) => {
    const x = sx(b.x);
    const y = sy(b.y);
    const w = ss(b.w);
    const h = ss(b.h);
    const r = Math.max(2, ss(12));
    if (b.kind === "diagnosis") {
      doc.setFillColor(13, 148, 136);
      doc.setDrawColor(94, 234, 212);
      doc.setLineWidth(0.7);
      doc.roundedRect(x, y, w, h, r, r, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(7, 11 * scale));
      doc.setTextColor(204, 251, 241);
      doc.text("ANCLA", x + w / 2, y + ss(22), { align: "center" });
      const labelLines = wrapPdfText(doc, b.label, w - ss(28), 5);
      doc.setFontSize(Math.max(9, 16 * scale));
      doc.setTextColor(240, 253, 250);
      let ty = y + ss(44);
      labelLines.forEach((line: string) => {
        doc.text(line, x + w / 2, ty, { align: "center" });
        ty += Math.max(10, 15 * scale);
      });
    } else if (b.kind === "section") {
      const isRuled = b.polarity === "ruled_out";
      doc.setFillColor(isRuled ? 136 : 17, isRuled ? 19 : 94, isRuled ? 55 : 89);
      doc.roundedRect(x, y, w, h, Math.max(1.5, ss(8)), Math.max(1.5, ss(8)), "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(7, 11 * scale));
      doc.setTextColor(236, 254, 255);
      doc.text(sanitizePdfText(b.label).toUpperCase(), x + w / 2, y + ss(22), {
        align: "center",
      });
    } else {
      const isRuled = b.polarity === "ruled_out";
      const isCriterion = b.polarity === "criterion";
      doc.setFillColor(30, 41, 59);
      if (isRuled) doc.setDrawColor(251, 113, 133);
      else if (isCriterion) doc.setDrawColor(167, 139, 250);
      else {
        doc.setDrawColor(
          b.weight === "primary" ? 45 : 51,
          b.weight === "primary" ? 212 : 65,
          b.weight === "primary" ? 191 : 85
        );
      }
      doc.setLineWidth(b.weight === "primary" ? 0.9 : 0.5);
      doc.roundedRect(x, y, w, h, r * 0.8, r * 0.8, "FD");
      if (isRuled) doc.setFillColor(225, 29, 72);
      else if (isCriterion) doc.setFillColor(139, 92, 246);
      else doc.setFillColor(20, 184, 166);
      doc.rect(x, y, Math.max(1.5, ss(5)), h, "F");
      const labelLines = wrapPdfText(doc, b.label, w - ss(20), 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(8, 13 * scale));
      doc.setTextColor(241, 245, 249);
      let ty = y + ss(24);
      labelLines.forEach((line: string) => {
        doc.text(line, x + w / 2, ty, { align: "center" });
        ty += Math.max(9, 13 * scale);
      });
      if (b.detail) {
        const detailLines = wrapPdfText(doc, b.detail, w - ss(20), 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(Math.max(6.5, 10 * scale));
        doc.setTextColor(148, 163, 184);
        let dy = y + h - ss(12) - (detailLines.length - 1) * Math.max(8, 11 * scale);
        detailLines.forEach((line: string) => {
          doc.text(line, x + w / 2, dy, { align: "center" });
          dy += Math.max(8, 11 * scale);
        });
      }
    }
  });
  void factor;
}

/**
 * Annex: rasterizes the same SVG used on-screen so PDF matches the console preview.
 */
export async function renderFindingsInfographicAnnexToPDF(
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

  doc.addPage();

  // Near-full page: small safe margins, expand scene to page aspect, scale to fill.
  const topSafe = 8 * factor;
  const bottomSafe = 8 * factor;
  const availH = Math.max(120, pageHeight - topSafe - bottomSafe);
  const frameAspect = availH / contentWidth; // height/width of printable area
  const scene = buildInfographicScene(data, { frameAspect });

  const scale = Math.min(contentWidth / scene.width, availH / scene.height);
  const drawW = scene.width * scale;
  const drawH = scene.height * scale;
  const ox = marginX + (contentWidth - drawW) / 2;
  const oy = topSafe + Math.max(0, (availH - drawH) / 2);

  try {
    const svg = buildInfographicSvgMarkup(scene);
    // High-DPI raster so print/PDF stays sharp
    const pxW = Math.round(scene.width * 2.25);
    const pxH = Math.round(scene.height * 2.25);
    const png = await rasterizeSvgToPng(svg, pxW, pxH);
    doc.addImage(png, "PNG", ox, oy, drawW, drawH, undefined, "FAST");
  } catch (err) {
    console.warn("Infografía: raster SVG falló, usando vector fallback:", err);
    renderVectorFallback(doc, scene, ox, oy, scale, factor);
  }

  void pageWidth;
}
