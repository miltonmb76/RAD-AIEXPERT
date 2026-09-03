import jsPDF from "jspdf";

export interface ElastographyPdfData {
  stiffnessKpa: number;
  capDbM: number;
  fatFractionPercent: number;
  etiology?: string;
  fibrosisStage: "F0" | "F1" | "F2" | "F3" | "F4";
  steatosisGrade: "S0" | "S1" | "S2" | "S3";
  bavenoClassification: string;
  histologicalCorrelation: string;
  velocityMs: number;
  iqrKpa: number;
  iqrMedianRatioPercent: number;
  originalImageBase64?: string | null;
  image3dBase64?: string | null;
}

function fibrosisMetavirLabel(stage: string): string {
  if (stage === "F0" || stage === "F1") return "F0-F1";
  return stage;
}

function valueColorForStiffness(kpa: number): [number, number, number] {
  if (kpa < 6.0) return [16, 185, 129];
  if (kpa < 8.0) return [234, 179, 8];
  if (kpa < 12.5) return [249, 115, 22];
  return [239, 68, 68];
}

function valueColorForFat(fat: number): [number, number, number] {
  if (fat < 5.0) return [16, 185, 129];
  if (fat <= 12.0) return [234, 179, 8];
  if (fat <= 20.0) return [249, 115, 22];
  return [239, 68, 68];
}

function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: "S" | "F" | "FD" = "S"
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

function drawGradientBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: Array<[number, number, number]>
) {
  const segW = w / colors.length;
  colors.forEach((c, i) => {
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(x + i * segW, y, segW + 0.2, h, "F");
  });
}

function normalizeImageData(base64: string): { data: string; format: "JPEG" | "PNG" } {
  const isJpeg = base64.includes("image/jpeg") || base64.includes("/9j/");
  const format: "JPEG" | "PNG" = isJpeg ? "JPEG" : "PNG";
  const data = base64.startsWith("data:")
    ? base64
    : `data:image/${format.toLowerCase()};base64,${base64}`;
  return { data, format };
}

/** Draw image inside a box preserving aspect ratio (contain + center). */
function drawImageContain(
  doc: jsPDF,
  base64: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): boolean {
  try {
    const { data, format } = normalizeImageData(base64);
    let aspect = 4 / 3;
    try {
      const props = doc.getImageProperties(data);
      if (props?.width && props?.height && props.height > 0) {
        aspect = props.width / props.height;
      }
    } catch {
      // keep default
    }

    let drawW = boxW;
    let drawH = drawW / aspect;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * aspect;
    }
    const dx = boxX + (boxW - drawW) / 2;
    const dy = boxY + (boxH - drawH) / 2;
    doc.addImage(data, format, dx, dy, drawW, drawH, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

/**
 * Single-page elastography annex. Layout is budgeted top-to-bottom so content
 * never overflows past the running footer.
 */
export function renderElastographyAnnexToPdf(
  doc: jsPDF,
  data: ElastographyPdfData,
  pageSize: "letter" | "a4" = "letter"
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  // Leave room for the app's running footer ("REPORTE RADIOLOGICO" / page #)
  const bottomSafe = 18;
  const contentWidth = pageWidth - marginX * 2;
  const factor = pageSize === "a4" ? 1.0 : 0.98;

  doc.addPage();

  const topY = 18 * factor;
  const pageBottom = pageHeight - bottomSafe;

  // Fixed section sizes (mm) — sum must leave room for workstation + gaps.
  const scalesH = 28 * factor;
  const cardH = 30 * factor;
  const gap = 4.5 * factor;
  const titleReserve = 15 * factor;
  const interpMin = 28 * factor;
  const techMin = 28 * factor;

  // Workstation gets leftover space, capped so images are not huge.
  const fixedBelowWs = scalesH + cardH + interpMin + techMin + gap * 4;
  const wsMax = 62 * factor; // ~moderate image block
  const wsMin = 48 * factor;
  const workstationH = Math.max(
    wsMin,
    Math.min(wsMax, pageBottom - topY - titleReserve - fixedBelowWs)
  );

  let y = topY;

  // ── TITLE ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ANEXO: EVALUACIÓN MULTIPARAMÉTRICA Y FUSIÓN 3D (ELASTOGRAFÍA & QUS)",
    marginX,
    y
  );
  y += 3.8 * factor;

  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4.5 * factor;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7 * factor);
  doc.setTextColor(100, 116, 139);
  const subtitle =
    "Mapeo multiparamétrico no invasivo de rigidez acústica tisular y fracción grasa cuantitativa, con renderización 3D híbrida predictiva del estado macroscópico del parénquima hepático.";
  const subLines = doc.splitTextToSize(subtitle, contentWidth);
  doc.text(subLines, marginX, y);
  y += subLines.length * 3.3 * factor + 3.5 * factor;

  // ── WORKSTATION ──────────────────────────────────────────────────────────
  const hasOriginal = !!data.originalImageBase64;
  const has3d = !!data.image3dBase64;
  const headerBarH = 6 * factor;
  const imgPad = 3 * factor;
  const imgGap = 4 * factor;
  const labelH = 5 * factor;
  const wsStartY = y;

  doc.setFillColor(30, 41, 59);
  drawRoundedRect(doc, marginX, y, contentWidth, workstationH, 2.2, "F");

  doc.setFillColor(8, 145, 178);
  doc.roundedRect(marginX, y, contentWidth, headerBarH, 2.2, 2.2, "F");
  doc.rect(marginX, y + headerBarH - 2, contentWidth, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2 * factor);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "WORKSTATION BIOMETRÍA TISULAR 2D/3D  •  MAPEO CROMÁTICO DE IMPEDANCIA Y ATENUACIÓN ACÚSTICA",
    marginX + 3 * factor,
    y + 4 * factor
  );

  const panelTop = y + headerBarH + imgPad;
  const panelW = (contentWidth - imgPad * 2 - imgGap) / 2;
  const panelImgH = workstationH - headerBarH - imgPad * 2 - labelH;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6 * factor);
  doc.setTextColor(125, 211, 252);
  doc.text("ORIGINAL (MODO B / ELASTOGRAMA)", marginX + imgPad, panelTop + 3.5 * factor);
  doc.text(
    "RECONSTRUCCIÓN 3D (IA)",
    marginX + imgPad + panelW + imgGap,
    panelTop + 3.5 * factor
  );

  const imgY = panelTop + labelH;
  const leftX = marginX + imgPad;
  const rightX = marginX + imgPad + panelW + imgGap;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(leftX, imgY, panelW, panelImgH, 1.2, 1.2, "F");
  doc.roundedRect(rightX, imgY, panelW, panelImgH, 1.2, 1.2, "F");

  const imgInset = 1.5 * factor;
  if (hasOriginal) {
    drawImageContain(
      doc,
      data.originalImageBase64!,
      leftX + imgInset,
      imgY + imgInset,
      panelW - imgInset * 2,
      panelImgH - imgInset * 2
    );
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin imagen original cargada", leftX + panelW / 2, imgY + panelImgH / 2, {
      align: "center",
    });
  }

  if (has3d) {
    drawImageContain(
      doc,
      data.image3dBase64!,
      rightX + imgInset,
      imgY + imgInset,
      panelW - imgInset * 2,
      panelImgH - imgInset * 2
    );
    doc.setFillColor(8, 145, 178);
    doc.roundedRect(rightX + 2.5, imgY + 2.5, 36 * factor, 5 * factor, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.4 * factor);
    doc.setTextColor(255, 255, 255);
    doc.text("RECONSTRUCCIÓN 3D (IA)", rightX + 4 * factor, imgY + 5.8 * factor);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7 * factor);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin reconstrucción 3D generada", rightX + panelW / 2, imgY + panelImgH / 2, {
      align: "center",
    });
  }

  y = wsStartY + workstationH + gap;

  // ── SCALES ───────────────────────────────────────────────────────────────
  const scalesStartY = y;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, marginX, y, contentWidth, scalesH, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESCALAS VISUALES DE ESTRATIFICACIÓN DIAGNÓSTICA (CONSENSO EFSUMB / SRU):",
    marginX + 3 * factor,
    y + 5 * factor
  );

  const labelColW = 44 * factor;
  const barX = marginX + labelColW;
  const barW = contentWidth - labelColW - 7 * factor;
  const barH = 3.2 * factor;
  const metavirLabel = fibrosisMetavirLabel(data.fibrosisStage);

  // Row 1 — Rigidez
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Rigidez (METAVIR): ${metavirLabel}`, marginX + 3 * factor, y + 11.5 * factor);
  drawGradientBar(doc, barX, y + 9.2 * factor, barW, barH, [
    [16, 185, 129],
    [234, 179, 8],
    [249, 115, 22],
    [239, 68, 68],
  ]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4 * factor);
  doc.setTextColor(100, 116, 139);
  ["F0-F1 (<6.0)", "F2 (6.0-7.9)", "F3 (8.0-12.4)", "F4 (>=12.5)"].forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), y + 16.2 * factor, { align: "center" });
  });

  // Row 2 — Esteatosis (clear gap under bar)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Esteatosis (QUS): ${data.steatosisGrade}`, marginX + 3 * factor, y + 22.5 * factor);
  drawGradientBar(doc, barX, y + 20.2 * factor, barW, barH, [
    [16, 185, 129],
    [132, 204, 22],
    [234, 179, 8],
    [249, 115, 22],
  ]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4 * factor);
  doc.setTextColor(100, 116, 139);
  ["S0 (<5.0%)", "S1 (5-12%)", "S2 (12-20%)", "S3 (>20%)"].forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), y + 27 * factor, { align: "center" });
  });

  y = scalesStartY + scalesH + gap;

  // ── 4 METRIC CARDS ───────────────────────────────────────────────────────
  const cardGap = 3 * factor;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const stiffColor = valueColorForStiffness(data.stiffnessKpa);
  const fatColor = valueColorForFat(data.fatFractionPercent);
  const iqrGood = data.iqrMedianRatioPercent <= 30;
  const iqrColor: [number, number, number] = iqrGood ? [139, 92, 246] : [249, 115, 22];
  const capCoeff = (data.capDbM / 100 / 3.5).toFixed(2);

  // Short footers that fit inside ~42mm card width (ASCII only for Helvetica)
  const cards: Array<{
    title: string;
    value: string;
    sub: string;
    footerLines: string[];
    border: [number, number, number];
    valueColor: [number, number, number];
  }> = [
    {
      title: "RIGIDEZ HEPÁTICA",
      value: `${data.stiffnessKpa.toFixed(1)} kPa`,
      sub: `METAVIR: ${metavirLabel}`,
      footerLines: ["V.N. < 6.0 kPa", "Corte F2: >= 7.0"],
      border: stiffColor,
      valueColor: stiffColor,
    },
    {
      title: "FRACCIÓN GRASA (QUS)",
      value: `${data.fatFractionPercent.toFixed(1)} %`,
      sub: `Esteatosis: ${data.steatosisGrade}`,
      footerLines: ["V.N. < 5.0%", "(Consenso SRU)"],
      border: fatColor,
      valueColor: fatColor,
    },
    {
      title: "ATENUACIÓN ACÚSTICA",
      value: `${Math.round(data.capDbM)} dB/m`,
      sub: `Coef: ${capCoeff} dB/cm/MHz`,
      footerLines: ["S0 < 238 dB/m", "S3 >= 290 dB/m"],
      border: [56, 189, 248],
      valueColor: [14, 165, 233],
    },
    {
      title: "CONFIABILIDAD TÉCNICA",
      value: iqrGood
        ? `IQR/med < ${Math.max(15, Math.ceil(data.iqrMedianRatioPercent))}%`
        : `IQR/med ${data.iqrMedianRatioPercent.toFixed(0)}%`,
      sub: "10/10 Adquisiciones",
      footerLines: ["Criterio EFSUMB:", "< 30% IQR/med"],
      border: iqrColor,
      valueColor: iqrColor,
    },
  ];

  cards.forEach((card, i) => {
    const cx = marginX + i * (cardW + cardGap);
    const padX = 2.5 * factor;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.setLineWidth(0.7);
    drawRoundedRect(doc, cx, y, cardW, cardH, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.6 * factor);
    doc.setTextColor(71, 85, 105);
    doc.text(card.title, cx + cardW / 2, y + 5 * factor, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12 * factor);
    doc.setTextColor(card.valueColor[0], card.valueColor[1], card.valueColor[2]);
    doc.text(card.value, cx + cardW / 2, y + 13 * factor, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4 * factor);
    doc.setTextColor(30, 41, 59);
    doc.text(card.sub, cx + cardW / 2, y + 18.5 * factor, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2 * factor);
    doc.setTextColor(100, 116, 139);
    card.footerLines.forEach((line, li) => {
      const clipped = doc.splitTextToSize(line, cardW - padX * 2)[0];
      doc.text(clipped, cx + cardW / 2, y + 23 * factor + li * 3.2 * factor, {
        align: "center",
      });
    });
  });

  y += cardH + gap;

  // Remaining vertical space split between interpretation and tech specs
  const remaining = pageBottom - y;
  const interpH = Math.max(interpMin, remaining * 0.52);
  const techH = Math.max(techMin, remaining - interpH - gap);
  // Recompute if rounding overflow
  const interpFinal = Math.min(interpH, remaining - techMin - gap);
  const techFinal = Math.min(techH, pageBottom - (y + interpFinal + gap));

  // ── INTERPRETATION ───────────────────────────────────────────────────────
  const fibDesc =
    data.fibrosisStage === "F0" || data.fibrosisStage === "F1"
      ? `compatible con parénquima hepático normal / sin fibrosis significativa (estadio ${metavirLabel}) según consenso EFSUMB/WFUMB`
      : data.fibrosisStage === "F2"
        ? "compatible con fibrosis significativa (F2); se sugiere correlación clínica y seguimiento"
        : data.fibrosisStage === "F3"
          ? "compatible con fibrosis avanzada (F3 / bridging); alto riesgo de progresión a cACLD"
          : "compatible con cirrosis establecida (F4 / cACLD); valorar hipertensión portal según Baveno VII";

  const steatDesc =
    data.steatosisGrade === "S0"
      ? "compatible con contenido graso normal (S0, < 5%)"
      : data.steatosisGrade === "S1"
        ? "compatible con esteatosis leve (S1)"
        : data.steatosisGrade === "S2"
          ? "compatible con esteatosis moderada (S2)"
          : "compatible con esteatosis severa (S3)";

  const bullets = [
    `Rigidez Tisular: El valor de ${data.stiffnessKpa.toFixed(1)} kPa es ${fibDesc}.`,
    `Fracción Grasa: El valor de ${data.fatFractionPercent.toFixed(1)}% / CAP ${Math.round(data.capDbM)} dB/m es ${steatDesc}.`,
    `Correlación Clínica: Se sugiere correlación con biomarcadores séricos (ALT/AST, FIB-4, APRI) y seguimiento clínico periódico según el perfil metabólico del paciente.`,
  ];

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, marginX, y, contentWidth, interpFinal, 2, "FD");
  doc.setFillColor(56, 189, 248);
  doc.rect(marginX, y + 1.2, 1.8 * factor, interpFinal - 2.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "INTERPRETACIÓN MÉDICA INTEGRADA Y CORRELACIÓN HISTOTISULAR:",
    marginX + 5 * factor,
    y + 5.5 * factor
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(51, 65, 85);
  const lineH = 3.5 * factor;
  let by = y + 11 * factor;
  const maxBy = y + interpFinal - 2.5 * factor;
  for (const b of bullets) {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 10 * factor);
    for (const line of lines) {
      if (by > maxBy) break;
      doc.text(line, marginX + 5 * factor, by);
      by += lineH;
    }
    by += 1.2 * factor;
    if (by > maxBy) break;
  }

  y += interpFinal + gap;

  // ── TECHNICAL SPECS (always fully inside page) ───────────────────────────
  const techBullets = [
    "Transductor: Sonda Abdominal Convex multifrecuencia (1.5-5.0 MHz).",
    "Modo: Point Shear Wave Elastography (pSWE / 2D-SWE).",
    "Muestreo: Profundidad ROI 2.0-5.0 cm de la cápsula hepática. Mapeo 3D: Reconstrucción volumétrica asistida por IA.",
    "Estándar de Calidad: Calibración Phantom NEMA y estándares QIBA / SRU / EFSUMB.",
  ];

  const techBoxH = Math.min(techFinal, pageBottom - y);
  if (techBoxH < 12) return; // nothing left; avoid drawing past footer

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, marginX, y, contentWidth, techBoxH, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESPECIFICACIONES TÉCNICAS DEL EQUIPO Y PROTOCOLO DE ADQUISICIÓN:",
    marginX + 3.5 * factor,
    y + 5.5 * factor
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(71, 85, 105);
  const techLineH = 3.4 * factor;
  let ty = y + 11 * factor;
  const techMaxY = y + techBoxH - 2.5 * factor;
  for (const b of techBullets) {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 8 * factor);
    for (const line of lines) {
      if (ty > techMaxY) return;
      doc.text(line, marginX + 3.5 * factor, ty);
      ty += techLineH;
    }
    ty += 1.0 * factor;
  }
}
