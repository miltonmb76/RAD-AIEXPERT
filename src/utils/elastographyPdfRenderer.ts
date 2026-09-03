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
  /** Original B-mode / elastogram photo (left panel) */
  originalImageBase64?: string | null;
  /** AI 3D reconstruction (right panel) */
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
    doc.rect(x + i * segW, y, segW + 0.15, h, "F");
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

/**
 * Draw image inside a box preserving original aspect ratio (contain + center).
 * Never stretches width/height independently.
 */
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
      // keep default 4:3
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
    try {
      const { data, format } = normalizeImageData(base64);
      // Fallback: still prefer 4:3 contain rather than stretch-fill
      const aspect = 4 / 3;
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
}

/**
 * Renders the dedicated elastography & QUS annex page.
 * Layout fills the page with comfortable spacing; images keep native aspect ratio.
 */
export function renderElastographyAnnexToPdf(
  doc: jsPDF,
  data: ElastographyPdfData,
  pageSize: "letter" | "a4" = "letter"
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const bottomSafe = 16;
  const contentWidth = pageWidth - marginX * 2;
  const factor = pageSize === "a4" ? 1.0 : 0.98;

  doc.addPage();

  // Vertical budget: distribute remaining space so the page does not look compressed.
  const topY = 18 * factor;
  const usableH = pageHeight - topY - bottomSafe;

  // Section height targets (sum ≈ usableH). Tuned for letter/A4.
  const titleBlockH = 16 * factor;
  const workstationH = Math.max(78 * factor, usableH * 0.38);
  const scalesH = 32 * factor;
  const cardH = 34 * factor;
  const gapAfterWs = 7 * factor;
  const gapAfterScales = 7 * factor;
  const gapAfterCards = 7 * factor;
  const reservedUpper =
    titleBlockH + workstationH + gapAfterWs + scalesH + gapAfterScales + cardH + gapAfterCards;
  const remainingForLower = Math.max(40 * factor, usableH - reservedUpper);
  const interpShare = 0.58;
  const interpTargetH = remainingForLower * interpShare;
  const techTargetH = remainingForLower * (1 - interpShare) - 4 * factor;

  let y = topY;

  // ── TITLE ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ANEXO: EVALUACIÓN MULTIPARAMÉTRICA Y FUSIÓN 3D (ELASTOGRAFÍA & QUS)",
    marginX,
    y
  );
  y += 4.2 * factor;

  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.55);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5.5 * factor;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.4 * factor);
  doc.setTextColor(100, 116, 139);
  const subtitle =
    "Mapeo multiparamétrico no invasivo de rigidez acústica tisular y fracción grasa cuantitativa, con renderización 3D híbrida predictiva del estado macroscópico del parénquima hepático.";
  const subLines = doc.splitTextToSize(subtitle, contentWidth);
  doc.text(subLines, marginX, y);
  y += subLines.length * 3.6 * factor + 5 * factor;

  // ── WORKSTATION DUAL PANEL (DARK) ────────────────────────────────────────
  const hasOriginal = !!data.originalImageBase64;
  const has3d = !!data.image3dBase64;
  const headerBarH = 7 * factor;
  const imgPad = 4 * factor;
  const imgGap = 5 * factor;
  const labelH = 6 * factor;
  const wsStartY = y;

  doc.setFillColor(30, 41, 59);
  drawRoundedRect(doc, marginX, y, contentWidth, workstationH, 2.5, "F");

  doc.setFillColor(8, 145, 178);
  doc.roundedRect(marginX, y, contentWidth, headerBarH, 2.5, 2.5, "F");
  doc.rect(marginX, y + headerBarH - 2.5, contentWidth, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(255, 255, 255);
  doc.text(
    "WORKSTATION BIOMETRÍA TISULAR 2D/3D  •  MAPEO CROMÁTICO DE IMPEDANCIA Y ATENUACIÓN ACÚSTICA",
    marginX + 3.5 * factor,
    y + 4.6 * factor
  );

  const panelTop = y + headerBarH + imgPad;
  const panelW = (contentWidth - imgPad * 2 - imgGap) / 2;
  const panelImgH = workstationH - headerBarH - imgPad * 2 - labelH - 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5 * factor);
  doc.setTextColor(125, 211, 252);
  doc.text("ORIGINAL (MODO B / ELASTOGRAMA)", marginX + imgPad, panelTop + 4 * factor);
  doc.text(
    "RECONSTRUCCIÓN 3D (IA)",
    marginX + imgPad + panelW + imgGap,
    panelTop + 4 * factor
  );

  const imgY = panelTop + labelH;
  const leftX = marginX + imgPad;
  const rightX = marginX + imgPad + panelW + imgGap;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(leftX, imgY, panelW, panelImgH, 1.5, 1.5, "F");
  doc.roundedRect(rightX, imgY, panelW, panelImgH, 1.5, 1.5, "F");

  const imgInset = 2 * factor;
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
    doc.setFontSize(7.5 * factor);
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
    doc.roundedRect(rightX + 3, imgY + 3, 40 * factor, 5.5 * factor, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8 * factor);
    doc.setTextColor(255, 255, 255);
    doc.text("RECONSTRUCCIÓN 3D (IA)", rightX + 4.5 * factor, imgY + 6.5 * factor);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5 * factor);
    doc.setTextColor(148, 163, 184);
    doc.text("Sin reconstrucción 3D generada", rightX + panelW / 2, imgY + panelImgH / 2, {
      align: "center",
    });
  }

  y = wsStartY + workstationH + gapAfterWs;

  // ── VISUAL STRATIFICATION SCALES ─────────────────────────────────────────
  // Two independent rows with clear gap between bar and tick labels.
  const scalesStartY = y;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, scalesH, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESCALAS VISUALES DE ESTRATIFICACIÓN DIAGNÓSTICA (CONSENSO EFSUMB / SRU):",
    marginX + 3.5 * factor,
    y + 5.5 * factor
  );

  const labelColW = 46 * factor;
  const barX = marginX + labelColW;
  const barW = contentWidth - labelColW - 8 * factor;
  const barH = 3.6 * factor;
  const metavirLabel = fibrosisMetavirLabel(data.fibrosisStage);

  // Row 1 — Rigidez
  const row1LabelY = y + 12.5 * factor;
  const row1BarY = y + 10.2 * factor;
  const row1TickY = y + 17.5 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Rigidez (METAVIR): ${metavirLabel}`, marginX + 3.5 * factor, row1LabelY);

  drawGradientBar(doc, barX, row1BarY, barW, barH, [
    [16, 185, 129],
    [234, 179, 8],
    [249, 115, 22],
    [239, 68, 68],
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8 * factor);
  doc.setTextColor(100, 116, 139);
  const tickLabels = ["F0-F1 (<6.0)", "F2 (6.0-7.9)", "F3 (8.0-12.4)", "F4 (≥12.5 kPa)"];
  tickLabels.forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), row1TickY, { align: "center" });
  });

  // Row 2 — Esteatosis (extra vertical separation so ticks never touch the bar)
  const row2LabelY = y + 25.5 * factor;
  const row2BarY = y + 23.2 * factor;
  const row2TickY = y + 30.2 * factor;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8 * factor);
  doc.setTextColor(51, 65, 85);
  doc.text(`Esteatosis (QUS): ${data.steatosisGrade}`, marginX + 3.5 * factor, row2LabelY);

  drawGradientBar(doc, barX, row2BarY, barW, barH, [
    [16, 185, 129],
    [132, 204, 22],
    [234, 179, 8],
    [249, 115, 22],
  ]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8 * factor);
  doc.setTextColor(100, 116, 139);
  const fatTicks = ["S0 (<5.0%)", "S1 (5-12%)", "S2 (12-20%)", "S3 (>20.0%)"];
  fatTicks.forEach((t, i) => {
    doc.text(t, barX + (i + 0.5) * (barW / 4), row2TickY, { align: "center" });
  });

  y = scalesStartY + scalesH + gapAfterScales;

  // ── 4 METRIC CARDS ───────────────────────────────────────────────────────
  const cardGap = 3.5 * factor;
  const cardW = (contentWidth - cardGap * 3) / 4;
  const stiffColor = valueColorForStiffness(data.stiffnessKpa);
  const fatColor = valueColorForFat(data.fatFractionPercent);
  const iqrGood = data.iqrMedianRatioPercent <= 30;
  const iqrColor: [number, number, number] = iqrGood ? [139, 92, 246] : [249, 115, 22];
  const capCoeff = (data.capDbM / 100 / 3.5).toFixed(2);

  const cards: Array<{
    title: string;
    value: string;
    sub: string;
    footer: string;
    border: [number, number, number];
    valueColor: [number, number, number];
  }> = [
    {
      title: "RIGIDEZ HEPÁTICA",
      value: `${data.stiffnessKpa.toFixed(1)} kPa`,
      sub: `METAVIR: ${metavirLabel}`,
      footer: "V.N. < 6.0 kPa  •  Corte F2: ≥ 7.0",
      border: stiffColor,
      valueColor: stiffColor,
    },
    {
      title: "FRACCIÓN GRASA (QUS)",
      value: `${data.fatFractionPercent.toFixed(1)} %`,
      sub: `Esteatosis: ${data.steatosisGrade}`,
      footer: "V.N. < 5.0% (Consenso SRU)",
      border: fatColor,
      valueColor: fatColor,
    },
    {
      title: "ATENUACIÓN ACÚSTICA (CAP)",
      value: `${Math.round(data.capDbM)} dB/m`,
      sub: `Coeficiente: ${capCoeff} dB/cm/MHz`,
      footer: "Ref: S0 < 238  •  S3 ≥ 290 dB/m",
      border: [56, 189, 248],
      valueColor: [14, 165, 233],
    },
    {
      title: "CONFIABILIDAD TÉCNICA",
      value: iqrGood
        ? `IQR/med < ${Math.max(15, Math.ceil(data.iqrMedianRatioPercent))}%`
        : `IQR/med ${data.iqrMedianRatioPercent.toFixed(0)}%`,
      sub: "10/10 Adquisiciones Válidas",
      footer: "Criterio EFSUMB/WFUMB: < 30%",
      border: iqrColor,
      valueColor: iqrColor,
    },
  ];

  cards.forEach((card, i) => {
    const cx = marginX + i * (cardW + cardGap);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.setLineWidth(0.75);
    drawRoundedRect(doc, cx, y, cardW, cardH, 2.2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6 * factor);
    doc.setTextColor(71, 85, 105);
    doc.text(card.title, cx + cardW / 2, y + 6 * factor, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5 * factor);
    doc.setTextColor(card.valueColor[0], card.valueColor[1], card.valueColor[2]);
    doc.text(card.value, cx + cardW / 2, y + 15.5 * factor, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7 * factor);
    doc.setTextColor(30, 41, 59);
    doc.text(card.sub, cx + cardW / 2, y + 22 * factor, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5 * factor);
    doc.setTextColor(100, 116, 139);
    const footLines = doc.splitTextToSize(card.footer, cardW - 5 * factor);
    doc.text(footLines, cx + cardW / 2, y + 27.5 * factor, { align: "center" });
  });

  y += cardH + gapAfterCards;

  // ── MEDICAL INTERPRETATION ───────────────────────────────────────────────
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4 * factor);
  const lineH = 4.0 * factor;
  const bulletGap = 2.2 * factor;
  let contentNeeded = 10 * factor;
  const wrappedBullets: string[][] = bullets.map((b) => {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 12 * factor);
    contentNeeded += lines.length * lineH + bulletGap;
    return lines;
  });
  contentNeeded += 3 * factor;
  const interpH = Math.max(interpTargetH, contentNeeded);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, interpH, 2.2, "FD");

  doc.setFillColor(56, 189, 248);
  doc.rect(marginX, y + 1.5, 2 * factor, interpH - 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "INTERPRETACIÓN MÉDICA INTEGRADA Y CORRELACIÓN HISTOTISULAR:",
    marginX + 6 * factor,
    y + 7 * factor
  );

  let by = y + 13 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4 * factor);
  doc.setTextColor(51, 65, 85);
  wrappedBullets.forEach((lines) => {
    doc.text(lines, marginX + 6 * factor, by);
    by += lines.length * lineH + bulletGap;
  });

  y += interpH + 5 * factor;

  // ── TECHNICAL SPECIFICATIONS (fill remaining page) ───────────────────────
  const techBullets = [
    "Transductor: Sonda Abdominal Convex multifrecuencia (1.5–5.0 MHz).",
    "Modo: Point Shear Wave Elastography (pSWE / 2D-SWE).",
    "Muestreo: Profundidad ROI 2.0–5.0 cm de la cápsula hepática. Mapeo 3D: Reconstrucción volumétrica asistida por IA.",
    "Estándar de Calidad: Calibración según Phantom NEMA y Estándares de Ultrasonografía Cuantitativa (QIBA / SRU / EFSUMB).",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  const techLineH = 3.8 * factor;
  let techContent = 11 * factor;
  const wrappedTech = techBullets.map((b) => {
    const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 10 * factor);
    techContent += lines.length * techLineH + 1.8 * factor;
    return lines;
  });
  techContent += 3 * factor;

  const maxTechH = pageHeight - y - bottomSafe;
  const techH = Math.max(techTargetH, Math.min(techContent, maxTechH));

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  drawRoundedRect(doc, marginX, y, contentWidth, techH, 2.2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2 * factor);
  doc.setTextColor(15, 23, 42);
  doc.text(
    "ESPECIFICACIONES TÉCNICAS DEL EQUIPO Y PROTOCOLO DE ADQUISICIÓN:",
    marginX + 4 * factor,
    y + 7 * factor
  );

  let ty = y + 13 * factor;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * factor);
  doc.setTextColor(71, 85, 105);
  wrappedTech.forEach((lines) => {
    if (ty + lines.length * techLineH < y + techH - 2) {
      doc.text(lines, marginX + 4 * factor, ty);
      ty += lines.length * techLineH + 1.8 * factor;
    }
  });
}
